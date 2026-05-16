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
            return;
        }

        api.logger.info(
            `[WeChat] Flushing buffered media-only block reason=${reason} count=${pendingMediaToSend.length}`,
        );

        for (const mediaCandidate of pendingMediaToSend) {
            await sendReplyMediaCandidate(mediaCandidate, "buffered-block");
        }
    };

    const schedulePendingBlockMediaFlush = () => {
        clearPendingBlockMediaTimer();
        pendingBlockMediaTimer = setTimeout(() => {
            void flushPendingBlockMediaPaths("timeout");
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
        hasPendingBlockMedia: () => pendingBlockMediaPaths.length > 0,
        hasAnySentMedia: () => sentMediaKeys.size > 0,
    };
}

export type WechatReplyMediaState = ReturnType<typeof createWechatReplyMediaState>;
