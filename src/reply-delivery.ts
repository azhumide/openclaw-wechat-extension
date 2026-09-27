import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { dispatchChannelInboundTurn } from "openclaw/plugin-sdk/channel-inbound";
import { resolveWechatExtensionConfig } from "./config.js";
import type { WechatInboundContext } from "./inbound-context.js";
import { createWechatReplyFinalBuffer } from "./reply-final-buffer.js";
import {
    collectWechatReplyMediaCandidates,
    extractWechatReplyTextAndBareMedia,
} from "./reply-media-candidates.js";
import { createWechatReplyMediaState } from "./reply-media-state.js";
import {
    sendWechatFallbackPartialReplyText,
    sendWechatReplyPayloadMedia,
    sendWechatReplyTextWithInlineMedia,
} from "./reply-send.js";
import {
    appendWechatCumulativeSentText,
    buildWechatReplyPayloadPreviews,
    deriveWechatIncrementalReplyText,
    isWechatReplyTextRedundantByWhitespace,
    mergeWechatReplyTurnText,
    normalizeWechatReplyTextForDelivery,
    readWechatPartialReplyText,
    readWechatReplyFinalErrorText,
    readWechatReplyIncomingText,
} from "./reply-text.js";
import { getWechatBlockedReplyForSession } from "./runtime.js";
import { renderWechatInteractiveFallback } from "./interactive-fallback.js";
import {
    redactWechatTextForLogs,
    rewriteWechatNonOwnerAddressing,
    stripFalseWechatMediaFailureSuffix,
    summarizeWechatTextForLog,
} from "./text.js";
import {
    shouldSuppressWechatToolFailureSummary,
} from "./tool-log.js";
import {
    createWechatBlockedLocalAttachmentNotifier,
    type SendWechatToolAuthNotice,
} from "./tool-auth-notice.js";

export async function dispatchWechatReplyForInbound(params: {
    api: OpenClawPluginApi;
    runtime: OpenClawPluginApi["runtime"];
    cfg: any;
    inbound: WechatInboundContext;
    sendWechatToolAuthNotice: SendWechatToolAuthNotice;
}): Promise<void> {
    const {
        api,
        runtime,
        cfg,
        inbound,
        sendWechatToolAuthNotice,
    } = params;
    const {
        accountId,
        chatType,
        ctx,
        from,
        isMaster,
        messageId,
        resolvedSenderId,
        resolvedSenderName,
        sessionKey,
        sessionChatKey,
        upstreamMessageTraceId,
    } = inbound;

    let cumulativeSentText = "";
    let turnTextSeen = "";
    let sawFinalErrorPayload = false;
    let finalErrorPayloadSummary = "";
    let localAttachmentBlockedThisTurn = false;
    let suppressedNaturalReplyAfterAuthBlock = false;
    let interactiveFallbackSent = false;
    const finalBuffer = createWechatReplyFinalBuffer();
    const replyMediaDispatchId = upstreamMessageTraceId || messageId;
    const mediaState = createWechatReplyMediaState({
        api,
        cfg,
        from,
        messageId,
        accountId,
        sessionKey,
        replyMediaDispatchId,
        upstreamMessageTraceId,
    });

    // P0 契约：投递回调的返回值决定核心如何给本次投递记账
    // (src/channels/turn/lifecycle.ts 的 settlePendingFinalDelivery)。
    // 裸 return(undefined) 会被核心记为「已投递」——即使实际什么都没发。
    // 因此每个出口都必须显式声明自己的语义。
    const suppressWechatDelivery = (): any => ({
        visibleReplySent: false,
        suppression: { reason: "no_visible_result" },
    });
    // 延后/未确认：内容将在本回合稍后投递（或投递结果无回执 id）。
    // 核心把 adapter_returned_no_identity 记为 "unknown"（pending），不计入已投递。
    const deferWechatDelivery = (): any => ({
        visibleReplySent: false,
        suppression: { reason: "adapter_returned_no_identity" },
    });

    const deliverWechatReply = async (...args: any[]) => {
        const bridgeConfig = resolveWechatExtensionConfig(cfg, api.logger);
        const replyAuthContext = {
            from,
            senderId: resolvedSenderId,
            isMaster,
        };
        const notifyBlockedLocalAttachmentOnce = createWechatBlockedLocalAttachmentNotifier({
            api,
            bridgeConfig,
            chatType,
            from,
            accountId,
            messageId,
            sendWechatToolAuthNotice,
        });
        const notifyBlockedLocalAttachment = async () => {
            localAttachmentBlockedThisTurn = true;
            await notifyBlockedLocalAttachmentOnce();
        };
        api.logger.info(`[WeChat Debug] DELIVER ARGS: ${args.length}, TYPES: ${args.map(a => typeof a)}`);

        // OpenClaw dispatcher arguments order: (payload, info)
        const payload = (typeof args[0] === "object" && args[0] !== null) ? args[0] : {};
        const info = (args.length > 1 && typeof args[1] === "object") ? args[1] : {};
        if (info.kind === "final" && payload?.isError === true) {
            sawFinalErrorPayload = true;
            const errorText = readWechatReplyFinalErrorText(payload);
            finalErrorPayloadSummary = summarizeWechatTextForLog(errorText || "final-error-payload", 120);
            const finalErrorSuppression = shouldSuppressWechatToolFailureSummary({
                payload,
                text: errorText,
                cumulativeSentText,
            });
            if (finalErrorSuppression.matched) {
                api.logger.warn?.(
                    `[WeChat] Suppressing final error payload reason=${finalErrorSuppression.reason} ` +
                    `session=${sessionKey} error="${finalErrorPayloadSummary}"`,
                );
                // 有意不发：工具失败摘要不应作为可见回复。必须显式告知核心，
                // 裸 return(undefined) 会被核心记为「已投递」。
                return suppressWechatDelivery();
            }
        }
        if (info.kind === "final" && !finalBuffer.isFlushing) {
            // 【方案 A】final 就地投递：缓冲本次 final 后**立即**在本次调用栈内 flush。
            // 真实发送与结果返回都发生在核心结算之前 → 核心拿到真实结果，
            // 而不是被喂一个「已投递」的假账（旧实现 `buffer + return` 的问题）。
            //
            // 合并/去重语义不变：flush 复用原有契约（回调期间 `isFlushing` 为真，
            // 于是上面的 final 分支被跳过，进入真正的发送逻辑）。
            //
            // 不能改用核心的 `finalization`：核心在 dispatchChannelInboundTurn 返回
            // **之前**就 await 它，而旧 flush 在返回**之后** → 会永久挂死。
            finalBuffer.buffer(args);
            const flushedResult = await flushBufferedFinalReply();
            return flushedResult ?? deferWechatDelivery();
        }
        const usePayloadOnlyText = info.kind === "final" && finalBuffer.isFlushing;

        if (!interactiveFallbackSent) {
            const interactiveText = renderWechatInteractiveFallback({
                payload,
                sessionKey,
                senderId: resolvedSenderId,
            });
            if (interactiveText) {
                interactiveFallbackSent = true;
                payload.text = interactiveText;
                payload.presentation = undefined;
                payload.interactive = undefined;
            }
        }

        // Track all text seen in this specific turn across all dispatcher calls
        // Read-only here, updates belong to onPartialReply
        const currentIncomingText = readWechatReplyIncomingText(args, payload);
        if (currentIncomingText && !usePayloadOnlyText) {
            turnTextSeen = mergeWechatReplyTurnText(turnTextSeen, currentIncomingText);
        }

        api.logger.info(
            `[WeChat Debug] Kind=${info.kind || "unknown"}, ` +
            `SeenLen=${usePayloadOnlyText ? currentIncomingText.length : turnTextSeen.length}, ` +
            `Payload: ${buildWechatReplyPayloadPreviews(payload).join(" | ")}`,
        );

        const rawFullText = usePayloadOnlyText ? currentIncomingText : turnTextSeen;
        const fullTextResult = normalizeWechatReplyTextForDelivery({
            text: rawFullText,
            stage: "full",
            logger: api.logger,
            bridgeConfig,
        });
        if (fullTextResult.shouldSkip) {
            return suppressWechatDelivery();
        }
        const fullText = fullTextResult.text;
        const blockedReply = typeof sessionKey === "string"
            ? getWechatBlockedReplyForSession(sessionKey)
            : undefined;

        // Deduplication logic:
        // 1. Identify new text relative to what we've already sent in this turn.
        // 2. Identify new media URLs.
        let newText = deriveWechatIncrementalReplyText(fullText, cumulativeSentText);
        const normalizedNewText = normalizeWechatReplyTextForDelivery({
            text: newText,
            stage: "incremental",
            logger: api.logger,
            bridgeConfig,
        });
        if (normalizedNewText.shouldSkip) {
            return suppressWechatDelivery();
        }
        newText = normalizedNewText.text;
        const redundantToolFailureSummary = shouldSuppressWechatToolFailureSummary({
            payload,
            text: newText,
            cumulativeSentText,
        });
        if (redundantToolFailureSummary.matched) {
            api.logger.info(
                `[WeChat] Skipping redundant tool failure summary stage=incremental reason=${redundantToolFailureSummary.reason} text="${summarizeWechatTextForLog(redactWechatTextForLogs(newText, bridgeConfig), 160)}"`,
            );
            return suppressWechatDelivery();
        }

        const extractedBareMedia = extractWechatReplyTextAndBareMedia({
            text: newText,
            workspaceBase: bridgeConfig.workspaceBase,
        });
        let textToProcess = rewriteWechatNonOwnerAddressing(extractedBareMedia.text, {
            isMaster,
            senderName: resolvedSenderName,
        });
        if (mediaState.hasAnySentMedia() && textToProcess) {
            const sanitizedText = stripFalseWechatMediaFailureSuffix(textToProcess);
            if (sanitizedText.stripped) {
                api.logger.info(
                    `[WeChat] Suppressed false media failure suffix after successful media send stage=${info.kind}`,
                );
                textToProcess = sanitizedText.text;
            }
        }

        // [Crucial Check] If we already sent this exact line, skip it
        // Normalize whitespace before comparison to catch block vs final formatting differences
        if (isWechatReplyTextRedundantByWhitespace({ cumulativeSentText, text: textToProcess })) {
            api.logger.info(`[WeChat] Skipping redundant ${info.kind} text (ws-normalized match): "${textToProcess.trim().substring(0, 30)}..."`);
            textToProcess = "";
        }

        const allMedia = await collectWechatReplyMediaCandidates({
            payload,
            bareMediaPaths: extractedBareMedia.mediaPaths,
            logger: api.logger,
            resolveDedupKey: mediaState.resolveMediaDedupKey,
            authContext: replyAuthContext,
            config: bridgeConfig,
            from,
            chatType,
            resolvedSenderId,
            notifyBlockedLocalAttachment,
        });

        if (localAttachmentBlockedThisTurn) {
            suppressedNaturalReplyAfterAuthBlock = true;
            api.logger.info(
                `[WeChat] Suppressing model reply after tool-auth block sessionKey=${sessionKey} ` +
                `reason=non-owner-local-file tool=${blockedReply?.toolName || ""} localAttachmentBlocked=true`,
            );
            return suppressWechatDelivery();
        }

        const hasNewMedia = mediaState.hasNewMediaCandidates(allMedia);
        const isMediaOnlyBlock = info.kind === "block" && !textToProcess && hasNewMedia;
        if (isMediaOnlyBlock) {
            const bufferedMediaCount = mediaState.bufferUnsentMediaOnlyBlock(allMedia);
            if (bufferedMediaCount > 0) {
                api.logger.info(
                    `[WeChat] Buffered media-only block count=${bufferedMediaCount} waitMs=${mediaState.pendingBlockMediaDelayMs}`,
                );
                // 延后：由 1.2s 定时器或回合末 flush 投递，此刻尚未发出。
                return deferWechatDelivery();
            }
        }

        if (textToProcess) {
            const pendingMediaMergeCount = mediaState.mergePendingBlockMediaInto(allMedia);
            if (pendingMediaMergeCount > 0) {
                api.logger.info(
                    `[WeChat] Merging buffered media-only block into text reply count=${pendingMediaMergeCount} kind=${info.kind || "unknown"}`,
                );
            }
        }

        // Regex-based media parsing also contributes to sentMediaKeys
        // We'll process the full text if it's the first time,
        // or just the newText if it's incremental.
        if (!textToProcess && !hasNewMedia) {
            api.logger.info(
                `[WeChat] Skipping redundant ${info.kind} reply (no new text/media)`,
            );
            return suppressWechatDelivery();
        }

        const logText = redactWechatTextForLogs(textToProcess, bridgeConfig).substring(0, 50).replace(/\n/g, "\\n");
        api.logger.info(`[WeChat] Delivering reply to ${from} (${chatType}): text="${logText}...", kind=${info.kind}`);

        await sendWechatReplyTextWithInlineMedia({
            text: textToProcess,
            payload,
            cfg,
            mediaState,
            logger: api.logger,
            bridgeConfig,
            replyAuthContext,
            from,
            chatType,
            resolvedSenderId,
            messageId,
            upstreamMessageTraceId,
            accountId,
            notifyBlockedLocalAttachment,
        });

        // Process explicit media urls from payload
        await sendWechatReplyPayloadMedia({
            mediaCandidates: allMedia,
            mediaState,
        });

        // Update turn state - ONLY text, NO placeholders
        if (textToProcess) {
            cumulativeSentText = appendWechatCumulativeSentText({
                cumulativeSentText,
                textToProcess,
            });
        }

        // 真实投递已完成：显式回报成功，供核心记账与观察者使用。
        return { visibleReplySent: true, content: textToProcess };
    };

    // 【方案 A】把缓冲的 final 就地投递，并把真实结果回传给核心。
    // 返回 undefined 表示没有待投递内容（flush 未触发回调）。
    //
    // 复用的是原有的 `finalBuffer.flush` 契约：它在调用回调期间把 `isFlushing` 置真，
    // 于是 `deliverWechatReply` 里那个 `info.kind === "final" && !isFlushing` 分支会
    // 被跳过、转而走真正的发送逻辑（`usePayloadOnlyText` 为真）。合并/去重语义不变。
    const flushBufferedFinalReply = async (): Promise<any> => {
        let deliveredResult: any;
        const flushed = await finalBuffer.flush(async (finalReplyArgs) => {
            api.logger.info(
                `[WeChat] Flushing buffered final reply in-call session=${sessionKey} ` +
                `trace=${replyMediaDispatchId} bufferedFinals=${finalBuffer.count}`,
            );
            deliveredResult = await deliverWechatReply(...finalReplyArgs);
        });
        return flushed ? deliveredResult : undefined;
    };

    const baseDispatcher = runtime.channel.reply.createReplyDispatcherWithTyping({
        onTyping: async () => { },
    } as any);

    const dispatchTurn = await dispatchChannelInboundTurn({
        cfg,
        channel: "wechat",
        accountId,
        route: {
            agentId: "main",
            sessionKey,
        },
        ctxPayload: runtime.channel.reply.finalizeInboundContext(ctx) as any,
        record: {
            updateLastRoute: {
                sessionKey,
                channel: "wechat",
                to: from,
                accountId,
                threadId: sessionChatKey,
            },
            onRecordError: (err) => {
                api.logger.warn?.(
                    `[WeChat] Failed to record inbound session route session=${sessionKey} err=${String(err)}`,
                );
            },
        },
        // 标准 direct 分支（路径 ②）：核心在调用本回调前已完成 payload 准备并跑过
        // `message_sending`，所以 `message_sending` 的唯一拥有者是核心。
        // 原用的 provider funnel 是官方定义的 "exceptional" 路径，会跳过核心钩子，
        // 并要求插件自行履行三项义务（授权断言 / 派发提交 / 绑定待决投递）——
        // 本插件一项未履行，故改走标准分支。
        delivery: {
            deliver: deliverWechatReply,
            onError: async (err) => {
                api.logger.warn?.(
                    `[WeChat] Reply delivery failed session=${sessionKey} err=${String(err)}`,
                );
            },
        },
        dispatcherOptions: {
            ...baseDispatcher,
        },
        replyOptions: {
            sourceReplyDeliveryMode: "automatic",
            onPartialReply: (payload) => {
                const txt = readWechatPartialReplyText(payload);
                if (txt) {
                    // 使用智能重叠合并，防止 AI 重复输出前缀导致的翻倍
                    turnTextSeen = mergeWechatReplyTurnText(turnTextSeen, txt);
                }
            }
        }
    });
    const dispatchResult = dispatchTurn.dispatchResult;

    // 【方案 A】回合末不再 flush final：final 已在 `deliverWechatReply` 内就地投递
    // 并回传真实结果。此处若再 flush 会把投递推迟到核心结算之后（核心看不见），
    // 且与就地投递重复。

    // [Fallback] Flush any remaining buffered media that was never merged into a text reply
    if (mediaState.hasPendingBlockMedia()) {
        await mediaState.flushPendingBlockMediaPaths("post-dispatch-settle");
    }

    if (suppressedNaturalReplyAfterAuthBlock) {
        api.logger.info(
            `[WeChat] Skipping fallback partial reply after tool-auth block session=${sessionKey} ` +
            `trace=${replyMediaDispatchId}`,
        );
    } else {
        cumulativeSentText = await sendWechatFallbackPartialReplyText({
            turnTextSeen,
            cumulativeSentText,
            sawFinalErrorPayload,
            finalErrorPayloadSummary,
            mediaWasSent: mediaState.hasAnySentMedia(),
            isMaster,
            senderName: resolvedSenderName,
            logger: api.logger,
            sessionKey,
            from,
            messageId,
            upstreamMessageTraceId,
            accountId,
            cfg,
        });
    }

    api.logger.info(
        `[WeChat Debug] Dispatch settled session=${sessionKey} trace=${replyMediaDispatchId} queuedFinal=${dispatchResult?.queuedFinal ? "true" : "false"} ` +
        `counts=${JSON.stringify(dispatchResult?.counts || {})} cumulativeTextLen=${cumulativeSentText.length} ` +
        `sentMedia=${mediaState.sentMediaCount} pendingMedia=${mediaState.pendingBlockMediaCount}`,
    );
}
