import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
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
        upstreamMessageTraceId,
    } = inbound;

    let cumulativeSentText = "";
    let turnTextSeen = "";
    let sawFinalErrorPayload = false;
    let finalErrorPayloadSummary = "";
    let localAttachmentBlockedThisTurn = false;
    let suppressedNaturalReplyAfterAuthBlock = false;
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
                return;
            }
        }
        if (info.kind === "final" && !finalBuffer.isFlushing) {
            const bufferedFinalReplyCount = finalBuffer.buffer(args);
            api.logger.info(
                `[WeChat] Buffered final reply until dispatch settles session=${sessionKey} ` +
                `trace=${replyMediaDispatchId} bufferedFinals=${bufferedFinalReplyCount}`,
            );
            return;
        }
        const usePayloadOnlyText = info.kind === "final" && finalBuffer.isFlushing;

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
            return;
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
            return;
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
            return;
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
            return;
        }

        const hasNewMedia = mediaState.hasNewMediaCandidates(allMedia);
        const isMediaOnlyBlock = info.kind === "block" && !textToProcess && hasNewMedia;
        if (isMediaOnlyBlock) {
            const bufferedMediaCount = mediaState.bufferUnsentMediaOnlyBlock(allMedia);
            if (bufferedMediaCount > 0) {
                api.logger.info(
                    `[WeChat] Buffered media-only block count=${bufferedMediaCount} waitMs=${mediaState.pendingBlockMediaDelayMs}`,
                );
                return;
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
            return;
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
    };

    const baseDispatcher = runtime.channel.reply.createReplyDispatcherWithTyping({
        onTyping: async () => { },
    } as any);

    const dispatchResult = await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
        ctx,
        cfg,
        dispatcherOptions: {
            ...baseDispatcher,
            deliver: deliverWechatReply,
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

    await finalBuffer.flush(async (finalReplyArgs) => {
        api.logger.info(
            `[WeChat] Flushing preferred buffered final reply session=${sessionKey} ` +
            `trace=${replyMediaDispatchId} bufferedFinals=${finalBuffer.count}`,
        );
        await deliverWechatReply(...finalReplyArgs);
    });

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
