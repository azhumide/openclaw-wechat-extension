import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { wechatPlugin } from "./channel.js";
import type { resolveWechatExtensionConfig } from "./config.js";
import type { WechatMediaCandidate } from "./media.js";
import type { WechatReplyMediaState } from "./reply-media-state.js";
import {
    rewriteWechatNonOwnerAddressing,
    stripFalseWechatMediaFailureSuffix,
    summarizeWechatTextForLog,
} from "./text.js";
import { shouldBlockWechatLocalAttachmentDelivery } from "./tool-auth-policy.js";
import { isWechatInternalStatusReply } from "./tool-log.js";

const INLINE_MEDIA_DIRECTIVE_RE = /(?:MEDIA|FILE):([^\s]+)/g;

export async function sendWechatReplyTextWithInlineMedia(params: {
    text: string;
    payload: any;
    cfg: any;
    mediaState: WechatReplyMediaState;
    logger: OpenClawPluginApi["logger"];
    bridgeConfig: ReturnType<typeof resolveWechatExtensionConfig>;
    replyAuthContext: {
        from?: string;
        senderId?: string;
        isMaster?: boolean;
    };
    from: string;
    chatType: string;
    resolvedSenderId?: string;
    messageId: string;
    upstreamMessageTraceId?: string;
    accountId: string;
    notifyBlockedLocalAttachment: () => Promise<void>;
}): Promise<void> {
    let cursor = 0;
    let match;

    while ((match = INLINE_MEDIA_DIRECTIVE_RE.exec(params.text)) !== null) {
        const precedingText = params.text.substring(cursor, match.index).trim();
        if (precedingText && wechatPlugin.outbound?.sendText) {
            await wechatPlugin.outbound.sendText({
                to: params.from,
                text: precedingText,
                msg_id: params.messageId,
                original_msg_id: params.upstreamMessageTraceId,
                accountId: params.accountId || "default",
                cfg: params.cfg,
            } as any);
        }

        const mediaPath = match[1];
        const mediaPathDedupKey = mediaPath
            ? params.mediaState.resolveMediaDedupKey(mediaPath)
            : "";
        if (
            mediaPath &&
            !params.mediaState.hasSentMediaKey(mediaPathDedupKey) &&
            !params.mediaState.isRecentlySentReplyMedia(mediaPathDedupKey)
        ) {
            const deliveryDecision = shouldBlockWechatLocalAttachmentDelivery({
                mediaUrl: mediaPath,
                authContext: params.replyAuthContext,
                config: params.bridgeConfig,
            });
            if (deliveryDecision.blocked) {
                params.logger.warn(
                    `[WeChat ToolAuth] Blocking inline local attachment delivery to ${params.from} (${params.chatType}) ` +
                    `sender=${params.resolvedSenderId} path="${summarizeWechatTextForLog(deliveryDecision.absolutePath || mediaPath, 180)}" ` +
                    `reason=${deliveryDecision.reason || "unknown"}`,
                );
                await params.notifyBlockedLocalAttachment();
                cursor = match.index + match[0].length;
                continue;
            }
            await params.mediaState.sendReplyMediaCandidate(
                {
                    mediaUrl: mediaPath,
                    dedupKey: mediaPathDedupKey,
                    ...(params.payload.audioAsVoice === true ? { audioAsVoice: true } : {}),
                },
                "inline-directive",
            );
        }
        cursor = match.index + match[0].length;
    }

    const remainingText = params.text.substring(cursor).trim();
    if (remainingText && wechatPlugin.outbound?.sendText) {
        await wechatPlugin.outbound.sendText({
            to: params.from,
            text: remainingText,
            msg_id: params.messageId,
            original_msg_id: params.upstreamMessageTraceId,
            accountId: params.accountId || "default",
            cfg: params.cfg,
        } as any);
    }
}

export async function sendWechatReplyPayloadMedia(params: {
    mediaCandidates: WechatMediaCandidate[];
    mediaState: WechatReplyMediaState;
}): Promise<void> {
    for (const mediaCandidate of params.mediaCandidates) {
        if (
            !params.mediaState.hasSentMediaKey(mediaCandidate.dedupKey) &&
            !params.mediaState.isRecentlySentReplyMedia(mediaCandidate.dedupKey)
        ) {
            await params.mediaState.sendReplyMediaCandidate(mediaCandidate, "payload-media");
        }
    }
}

export async function sendWechatFallbackPartialReplyText(params: {
    turnTextSeen: string;
    cumulativeSentText: string;
    sawFinalErrorPayload: boolean;
    finalErrorPayloadSummary: string;
    mediaWasSent: boolean;
    isMaster: boolean;
    senderName?: string;
    logger: OpenClawPluginApi["logger"];
    sessionKey: string;
    from: string;
    messageId: string;
    upstreamMessageTraceId?: string;
    accountId: string;
    cfg: any;
}): Promise<string> {
    const unseenText = rewriteWechatNonOwnerAddressing(params.turnTextSeen.trim(), {
        isMaster: params.isMaster,
        senderName: params.senderName,
    });
    const finalUnseenText =
        params.mediaWasSent && unseenText
            ? stripFalseWechatMediaFailureSuffix(unseenText).text
            : unseenText;

    if (!params.cumulativeSentText && finalUnseenText && wechatPlugin.outbound?.sendText) {
        const internalCheck = isWechatInternalStatusReply(finalUnseenText);
        const hasNoReply = finalUnseenText.toUpperCase().includes("NO_REPLY");
        if (params.sawFinalErrorPayload) {
            params.logger.warn?.(
                `[WeChat] Suppressing fallback partial text because final error payload was observed ` +
                `session=${params.sessionKey} error="${params.finalErrorPayloadSummary}" ` +
                `partial="${summarizeWechatTextForLog(finalUnseenText, 120)}"`,
            );
        } else if (!internalCheck.matched && !hasNoReply) {
            params.logger.info(
                `[WeChat] Fallback: deliver never sent text but onPartialReply captured content, sending now ` +
                `session=${params.sessionKey} textLen=${finalUnseenText.length} text="${summarizeWechatTextForLog(finalUnseenText, 120)}"`,
            );
            await wechatPlugin.outbound.sendText({
                to: params.from,
                text: finalUnseenText,
                msg_id: params.messageId,
                original_msg_id: params.upstreamMessageTraceId,
                accountId: params.accountId || "default",
                cfg: params.cfg,
            } as any);
            return finalUnseenText;
        }
    }

    return params.cumulativeSentText;
}
