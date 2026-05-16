import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { resolveWechatExtensionConfig } from "./config.js";
import {
    extractWechatBareLocalMediaFromText,
    filterWechatExistingMediaCandidates,
    type WechatMediaCandidate,
} from "./media.js";
import { summarizeWechatTextForLog } from "./text.js";
import { shouldBlockWechatLocalAttachmentDelivery } from "./tool-auth-policy.js";

export function extractWechatReplyTextAndBareMedia(params: {
    text: string;
    workspaceBase?: string;
}): {
    text: string;
    mediaPaths: string[];
} {
    return extractWechatBareLocalMediaFromText({
        text: params.text,
        workspaceBase: params.workspaceBase,
    });
}

export async function collectWechatReplyMediaCandidates(params: {
    payload: any;
    bareMediaPaths: string[];
    logger: OpenClawPluginApi["logger"];
    resolveDedupKey: (mediaUrl: string) => string;
    authContext: {
        from?: string;
        senderId?: string;
        isMaster?: boolean;
    };
    config: ReturnType<typeof resolveWechatExtensionConfig>;
    from: string;
    chatType: string;
    resolvedSenderId?: string;
    notifyBlockedLocalAttachment: () => Promise<void>;
}): Promise<WechatMediaCandidate[]> {
    const rawMedia = [...(params.payload.mediaUrls || []), ...params.bareMediaPaths];
    if (params.payload.mediaUrl && !rawMedia.includes(params.payload.mediaUrl)) {
        rawMedia.push(params.payload.mediaUrl);
    }

    const existingMedia = filterWechatExistingMediaCandidates({
        mediaUrls: rawMedia,
        logger: params.logger,
        resolveDedupKey: params.resolveDedupKey,
    });

    const mediaCandidates: WechatMediaCandidate[] = [];
    for (const mediaCandidate of existingMedia) {
        if (params.payload.audioAsVoice === true) {
            mediaCandidate.audioAsVoice = true;
        }
        const deliveryDecision = shouldBlockWechatLocalAttachmentDelivery({
            mediaUrl: mediaCandidate.mediaUrl,
            authContext: params.authContext,
            config: params.config,
        });
        if (deliveryDecision.blocked) {
            params.logger.warn(
                `[WeChat ToolAuth] Blocking outbound local attachment delivery to ${params.from} (${params.chatType}) ` +
                `sender=${params.resolvedSenderId} path="${summarizeWechatTextForLog(deliveryDecision.absolutePath || mediaCandidate.mediaUrl, 180)}" ` +
                `reason=${deliveryDecision.reason || "unknown"}`,
            );
            await params.notifyBlockedLocalAttachment();
            continue;
        }
        mediaCandidates.push(mediaCandidate);
    }

    for (const derivedMediaPath of params.bareMediaPaths) {
        if (!params.payload.mediaUrl && !(params.payload.mediaUrls || []).includes(derivedMediaPath)) {
            params.logger.info(
                `[WeChat] Promoted bare local file path to media delivery path="${summarizeWechatTextForLog(derivedMediaPath, 180)}"`,
            );
        }
    }

    return mediaCandidates;
}
