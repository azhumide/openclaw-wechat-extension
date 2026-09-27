import * as path from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { wechatPlugin } from "./channel.js";
import {
    buildWechatReplyMediaDedupKey,
    claimWechatReplyMediaDedup,
    hasRecentWechatReplyMedia,
    releaseWechatReplyMediaDedup,
} from "./dedup.js";
import {
    buildWechatMediaDedupKey,
    isWechatLocalMediaReference,
    type WechatMediaCandidate,
} from "./media.js";
import { createWechatMediaOnlyDeferralSlot } from "./reply-media-deferral.js";
import { summarizeWechatTextForLog } from "./text.js";

export type WechatReplyMediaSource =
    | "buffered-block"
    | "inline-directive"
    | "payload-media";

export function createWechatReplyMediaState(params: {
    api: OpenClawPluginApi;
    cfg: any;
    from: string;
    messageId: string;
    accountId: string;
    sessionKey: string;
    replyMediaDispatchId: string;
    upstreamMessageTraceId?: string;
}) {
    const {
        api,
        cfg,
        from,
        messageId,
        accountId,
        sessionKey,
        replyMediaDispatchId,
        upstreamMessageTraceId,
    } = params;
    const sentMediaKeys = new Set<string>();
    let pendingBlockMediaPaths: WechatMediaCandidate[] = [];
    let pendingBlockMediaTimer: ReturnType<typeof setTimeout> | null = null;
    const pendingBlockMediaDelayMs = 1200;
    const mediaDedupKeyCache = new Map<string, string>();
    // 媒体-only 延后的「最终结果」所有权。核心等待这个承诺来确认本次投递，
    // 所以每条出口都必须结算它（详见 reply-media-deferral.ts 的说明）。
    const mediaOnlyDeferral = createWechatMediaOnlyDeferralSlot();

    const resolveMediaDedupKey = (mediaUrl: string) => {
        const trimmed = mediaUrl.trim();
        const cacheKey = isWechatLocalMediaReference(trimmed)
            ? `local:${path.resolve(trimmed)}`
            : `remote:${trimmed}`;
        const cached = mediaDedupKeyCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const dedupKey = buildWechatMediaDedupKey({
            mediaUrl: trimmed,
            logger: api.logger,
        });
        mediaDedupKeyCache.set(cacheKey, dedupKey);
        return dedupKey;
    };

    const buildReplyMediaScopeKey = (mediaDedupKey: string) =>
        buildWechatReplyMediaDedupKey({
            sessionKey,
            dispatchId: replyMediaDispatchId,
            mediaDedupKey,
        });

    const isRecentlySentReplyMedia = (mediaDedupKey: string) =>
        hasRecentWechatReplyMedia(buildReplyMediaScopeKey(mediaDedupKey));

    const sendReplyMediaCandidate = async (
        mediaCandidate: WechatMediaCandidate,
        source: WechatReplyMediaSource,
    ) => {
        if (!wechatPlugin.outbound?.sendMedia) {
            return false;
        }
        if (sentMediaKeys.has(mediaCandidate.dedupKey)) {
            return false;
        }

        const replyMediaScopeKey = buildReplyMediaScopeKey(mediaCandidate.dedupKey);
        if (!claimWechatReplyMediaDedup(replyMediaScopeKey)) {
            api.logger.info(
                `[WeChat] Skipping recent duplicate reply media session=${sessionKey} trace=${replyMediaDispatchId} ` +
                `source=${source} media="${summarizeWechatTextForLog(mediaCandidate.mediaUrl, 180)}"`,
            );
            return false;
        }

        sentMediaKeys.add(mediaCandidate.dedupKey);
        try {
            const sendResult = await wechatPlugin.outbound.sendMedia({
                to: from,
                mediaUrl: mediaCandidate.mediaUrl,
                text: "",
                msg_id: messageId,
                original_msg_id: upstreamMessageTraceId,
                accountId: accountId || "default",
                ...(mediaCandidate.audioAsVoice === true ? { audioAsVoice: true } : {}),
                cfg,
            } as any);
            if (sendResult?.ok === false) {
                sentMediaKeys.delete(mediaCandidate.dedupKey);
                releaseWechatReplyMediaDedup(replyMediaScopeKey);
                return false;
            }
            return true;
        } catch (err) {
            sentMediaKeys.delete(mediaCandidate.dedupKey);
            releaseWechatReplyMediaDedup(replyMediaScopeKey);
            throw err;
        }
    };

    const clearPendingBlockMediaTimer = () => {
        if (pendingBlockMediaTimer) {
            clearTimeout(pendingBlockMediaTimer);
            pendingBlockMediaTimer = null;
        }
    };

    const takePendingBlockMediaPaths = () => {
        const uniquePending = pendingBlockMediaPaths.filter((candidate, index, list) =>
            !!candidate?.mediaUrl &&
            list.findIndex((item) => item.dedupKey === candidate.dedupKey) === index &&
            !sentMediaKeys.has(candidate.dedupKey) &&
            !isRecentlySentReplyMedia(candidate.dedupKey),
        );
        pendingBlockMediaPaths = [];
        return uniquePending;
    };

    const flushPendingBlockMediaPaths = async (reason: string) => {
        clearPendingBlockMediaTimer();
        const pendingMediaToSend = takePendingBlockMediaPaths();
        if (!pendingMediaToSend.length) {
            // 没有实际可发的内容（候选全为重复/已被合并）：诚实结算为「有意不发」。
            // 关键：不能直接 return —— 核心在等这个承诺，悬着会挂死会话。
            mediaOnlyDeferral.settleNothingSent();
            return;
        }

        api.logger.info(
            `[WeChat] Flushing buffered media-only block reason=${reason} count=${pendingMediaToSend.length}`,
        );

        let sentCount = 0;
        try {
            for (const mediaCandidate of pendingMediaToSend) {
                const sent = await sendReplyMediaCandidate(mediaCandidate, "buffered-block");
                if (sent) {
                    sentCount += 1;
                }
            }
        } catch (err) {
            // 必须拒绝承诺：否则核心会永远等待这次投递，整个会话挂死。
            mediaOnlyDeferral.fail(err);
            throw err;
        }

        // 只有真的发出至少一条才敢说「已投递」；否则诚实说「有意不发」。
        if (sentCount > 0) {
            mediaOnlyDeferral.settleDelivered();
        } else {
            mediaOnlyDeferral.settleNothingSent();
        }
    };

    const schedulePendingBlockMediaFlush = () => {
        clearPendingBlockMediaTimer();
        pendingBlockMediaTimer = setTimeout(() => {
            // 承诺的拒绝由 flush 内部负责（settle/fail）；这里只需吞掉冒泡出的异常，
            // 避免定时器回调里的异步失败变成 unhandledRejection 打死进程。
            void flushPendingBlockMediaPaths("timeout").catch((err) => {
                api.logger.warn?.(
                    `[WeChat] Deferred media-only flush failed session=${sessionKey} ` +
                    `trace=${replyMediaDispatchId} err=${String(err)}`,
                );
            });
        }, pendingBlockMediaDelayMs);
    };

    const pushPendingBlockMedia = (mediaCandidates: WechatMediaCandidate[]) => {
        pendingBlockMediaPaths.push(...mediaCandidates);
        schedulePendingBlockMediaFlush();
    };

    const hasPendingBlockMediaKey = (dedupKey: string) =>
        pendingBlockMediaPaths.some((item) => item.dedupKey === dedupKey);

    const hasNewMediaCandidates = (mediaCandidates: WechatMediaCandidate[]) =>
        mediaCandidates.some(
            (candidate) =>
                !sentMediaKeys.has(candidate.dedupKey) &&
                !isRecentlySentReplyMedia(candidate.dedupKey),
        );

    const bufferUnsentMediaOnlyBlock = (mediaCandidates: WechatMediaCandidate[]) => {
        const unsentMedia = mediaCandidates.filter(
            (candidate, index, list) =>
                !sentMediaKeys.has(candidate.dedupKey) &&
                !isRecentlySentReplyMedia(candidate.dedupKey) &&
                list.findIndex((item) => item.dedupKey === candidate.dedupKey) === index &&
                !hasPendingBlockMediaKey(candidate.dedupKey),
        );
        if (!unsentMedia.length) {
            return 0;
        }
        pushPendingBlockMedia(unsentMedia);
        return unsentMedia.length;
    };

    const mergePendingBlockMediaInto = (mediaCandidates: WechatMediaCandidate[]) => {
        if (!pendingBlockMediaPaths.length) {
            return 0;
        }
        // 媒体即将随本次文本投递一起发出：本次自身不再有独立可见投递。
        // 必须先结算，否则先前那个延后承诺会一直悬着（定时器发现列表已空就 return 了）。
        mediaOnlyDeferral.settleSuperseded();
        const pendingMediaToMerge = takePendingBlockMediaPaths();
        for (const pendingMedia of pendingMediaToMerge) {
            if (!mediaCandidates.some((item) => item.dedupKey === pendingMedia.dedupKey)) {
                mediaCandidates.push(pendingMedia);
            }
        }
        return pendingMediaToMerge.length;
    };

    return {
        get pendingBlockMediaCount() {
            return pendingBlockMediaPaths.length;
        },
        get pendingBlockMediaDelayMs() {
            return pendingBlockMediaDelayMs;
        },
        get sentMediaCount() {
            return sentMediaKeys.size;
        },
        hasSentMediaKey: (dedupKey: string) => sentMediaKeys.has(dedupKey),
        isRecentlySentReplyMedia,
        resolveMediaDedupKey,
        sendReplyMediaCandidate,
        flushPendingBlockMediaPaths,
        hasNewMediaCandidates,
        bufferUnsentMediaOnlyBlock,
        mergePendingBlockMediaInto,
        /**
         * 声明「本次媒体-only 投递延后」，返回交给核心的 `finalization` 承诺。
         * 核心会 await 它并据此记账，因此必须由某条出口结算（见 reply-media-deferral.ts）。
         */
        beginMediaOnlyDeferral: () => mediaOnlyDeferral.defer(),
        /** 是否存在尚未结算的媒体延后（自检用）。 */
        get hasOutstandingMediaOnlyDeferral() {
            return mediaOnlyDeferral.isOutstanding;
        },
        hasPendingBlockMedia: () => pendingBlockMediaPaths.length > 0,
        hasAnySentMedia: () => sentMediaKeys.size > 0,
    };
}

export type WechatReplyMediaState = ReturnType<typeof createWechatReplyMediaState>;
