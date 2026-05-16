import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { resolveWechatExtensionConfig } from "./config.js";
import { markWechatBlockedReplyForSession } from "./runtime.js";
import type { WechatInboundContext } from "./inbound-context.js";
import {
    matchWechatBlockedSkillIntent,
    normalizeWechatSkillIdList,
} from "./tool-auth-policy.js";
import {
    buildWechatToolNoticeText,
    shouldSendWechatToolAuthNotice,
    type SendWechatToolAuthNotice,
    type WechatToolNoticeContext,
} from "./tool-auth-notice.js";

export async function maybeHandleWechatBlockedSkillIntent(params: {
    api: OpenClawPluginApi;
    bridgeConfig: ReturnType<typeof resolveWechatExtensionConfig>;
    inbound: WechatInboundContext;
    sendWechatToolAuthNotice: SendWechatToolAuthNotice;
}): Promise<boolean> {
    const { api, bridgeConfig, inbound, sendWechatToolAuthNotice } = params;
    const blockedSkills = normalizeWechatSkillIdList(bridgeConfig.toolAuthBlockedSkills);
    const blockedSkillIntent = !inbound.isMaster
        ? matchWechatBlockedSkillIntent(inbound.content, blockedSkills)
        : { matched: false as const };
    if (!blockedSkillIntent.matched || !blockedSkillIntent.skillId) {
        return false;
    }

    const noticeContext: WechatToolNoticeContext = {
        from: inbound.from,
        accountId: inbound.accountId,
        messageId: inbound.messageId,
        chatType: inbound.chatType,
        conversationLabel: inbound.conversationLabel,
        senderId: inbound.resolvedSenderId,
        senderName: inbound.resolvedSenderName,
        skillId: blockedSkillIntent.skillId,
        content: inbound.content,
    };
    api.logger.warn(
        `[WeChat ToolAuth] Short-circuit blocked skill intent skill=${blockedSkillIntent.skillId} ` +
        `alias=${blockedSkillIntent.alias || ""} chatType=${inbound.chatType} ` +
        `from=${inbound.from} sender=${inbound.resolvedSenderId}`,
    );
    markWechatBlockedReplyForSession({
        sessionKey: inbound.sessionKey,
        toolName: "skill-intent",
        reason: `blocked-skill-intent:${blockedSkillIntent.skillId}`,
        noticeSent: false,
    });
    if (shouldSendWechatToolAuthNotice(bridgeConfig, {
        state: "blocked",
        chatType: inbound.chatType,
    })) {
        await sendWechatToolAuthNotice(
            api,
            noticeContext,
            buildWechatToolNoticeText({
                toolName: blockedSkillIntent.skillId,
                state: "blocked",
                authContext: noticeContext,
                config: bridgeConfig,
            }),
        );
    }
    return true;
}
