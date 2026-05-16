import type { resolveWechatExtensionConfig } from "./config.js";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import {
    getWechatToolAuthFallbackForSession,
    getWechatToolAuthForRun,
    getWechatToolAuthForSession,
} from "./runtime.js";
import { summarizeWechatTextForLog } from "./text.js";

export type WechatToolNoticeState =
    | "queued"
    | "allow-once"
    | "allow-always"
    | "deny"
    | "timeout"
    | "cancelled"
    | "blocked";

export type WechatToolNoticeContext = {
    from?: string;
    accountId?: string;
    messageId?: string;
    chatType?: "group" | "direct";
    conversationLabel?: string;
    senderId?: string;
    senderName?: string;
    skillId?: string;
    content?: string;
};

export type SendWechatToolAuthNotice = (
    api: OpenClawPluginApi,
    authContext: {
        from?: string;
        accountId?: string;
        messageId?: string;
        [key: string]: unknown;
    },
    text: string,
) => Promise<void>;

function getWechatToolNoticeStateLabel(state: WechatToolNoticeState): string {
    switch (state) {
        case "queued":
            return "已提交审批";
        case "allow-once":
            return "本次已批准";
        case "allow-always":
            return "已设为总是允许";
        case "deny":
            return "审批被拒绝";
        case "timeout":
            return "审批超时";
        case "cancelled":
            return "审批已取消";
        case "blocked":
            return "无权限";
        default:
            return state;
    }
}

function getWechatChatTypeLabel(chatType?: string): string {
    return chatType === "group" ? "群聊" : "私聊";
}

function renderWechatToolNoticeTemplate(template: string, params: {
    toolName: string;
    state: WechatToolNoticeState;
    authContext: WechatToolNoticeContext;
}): string {
    const replacements: Record<string, string> = {
        toolName: params.toolName,
        state: params.state,
        stateLabel: getWechatToolNoticeStateLabel(params.state),
        senderId: params.authContext.senderId || "",
        senderName: params.authContext.senderName || "",
        skillId: params.authContext.skillId || "",
        from: params.authContext.from || "",
        chatType: params.authContext.chatType || "",
        chatTypeLabel: getWechatChatTypeLabel(params.authContext.chatType),
        conversationLabel: params.authContext.conversationLabel || "",
        question: params.authContext.content || "",
    };
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
        return replacements[key] ?? "";
    }).trim();
}

export function buildWechatToolApprovalDescription(toolName: string, authContext: {
    from?: string;
    accountId?: string;
    chatType?: string;
    conversationLabel?: string;
    senderId?: string;
    senderName?: string;
    content?: string;
}): string {
    const location = authContext.chatType === "group"
        ? `群 "${authContext.conversationLabel || authContext.from || "unknown"}"`
        : "私聊";
    const sender = authContext.senderName && authContext.senderName !== authContext.senderId
        ? `${authContext.senderName} (${authContext.senderId || "unknown"})`
        : (authContext.senderId || authContext.senderName || "unknown");
    const lines = [
        `${location} 中的微信发送者 ${sender} 请求执行工具 "${toolName}"。`,
    ];
    const questionPreview = summarizeWechatTextForLog(authContext.content, 200);
    if (questionPreview) {
        lines.push(`原始消息: ${questionPreview}`);
    }
    lines.push("批准一次后继续当前运行。");
    return lines.join("\n");
}

export function buildWechatToolNoticeText(params: {
    toolName: string;
    state: WechatToolNoticeState;
    authContext: WechatToolNoticeContext;
    config: ReturnType<typeof resolveWechatExtensionConfig>;
}): string {
    const customTemplate = (() => {
        switch (params.state) {
            case "queued":
                return params.config.toolAuthMessageQueued;
            case "allow-once":
                return params.config.toolAuthMessageAllowOnce;
            case "allow-always":
                return params.config.toolAuthMessageAllowAlways;
            case "deny":
                return params.config.toolAuthMessageDeny;
            case "timeout":
                return params.config.toolAuthMessageTimeout;
            case "cancelled":
                return params.config.toolAuthMessageCancelled;
            case "blocked":
                return params.config.toolAuthMessageBlocked;
            default:
                return undefined;
        }
    })();
    if (customTemplate) {
        return renderWechatToolNoticeTemplate(customTemplate, params);
    }

    const toolLabel = params.toolName;
    const skillLabel = params.authContext.skillId ? ` / skill=${params.authContext.skillId}` : "";
    switch (params.state) {
        case "queued":
            return `检测到敏感工具申请: ${toolLabel}\n已提交审批，请稍候。`;
        case "allow-once":
            return `敏感工具审批已通过: ${toolLabel}\n本次执行继续进行。`;
        case "allow-always":
            return `敏感工具审批已设为总是允许: ${toolLabel}\n当前执行继续进行。`;
        case "deny":
            return `敏感工具审批被拒绝: ${toolLabel}\n本次不会执行。`;
        case "timeout":
            return `敏感工具审批超时: ${toolLabel}\n本次不会执行。`;
        case "cancelled":
            return `敏感工具审批已取消: ${toolLabel}\n本次不会执行。`;
        case "blocked":
            return params.authContext.skillId
                ? `当前 skill 已禁止普通用户使用: ${params.authContext.skillId}\n关联工具: ${toolLabel}\n如需执行，请由主人微信发起。`
                : `你没有权限调用敏感工具: ${toolLabel}${skillLabel}\n如需执行，请由主人微信发起，或改成审批模式。`;
        default:
            return `敏感工具状态已更新: ${toolLabel}`;
    }
}

export function shouldSendWechatToolAuthNotice(config: ReturnType<typeof resolveWechatExtensionConfig>, params: {
    state: WechatToolNoticeState;
    chatType?: "group" | "direct";
}): boolean {
    if (params.chatType === "group" && !config.toolAuthNotifyInGroup) {
        return false;
    }
    if (params.chatType !== "group" && !config.toolAuthNotifyInDirect) {
        return false;
    }
    if (params.state === "blocked") {
        return config.toolAuthNotifyBlocked;
    }
    if (params.state === "queued") {
        return config.toolAuthNotifyApprovalQueued;
    }
    return config.toolAuthNotifyApprovalResolved;
}

export function createWechatBlockedLocalAttachmentNotifier(params: {
    api: OpenClawPluginApi;
    bridgeConfig: ReturnType<typeof resolveWechatExtensionConfig>;
    chatType: "group" | "direct";
    from: string;
    accountId: string;
    messageId: string;
    sendWechatToolAuthNotice: SendWechatToolAuthNotice;
}): () => Promise<void> {
    let localAttachmentBlocked = false;
    return async () => {
        if (localAttachmentBlocked) {
            return;
        }
        localAttachmentBlocked = true;
        if (!shouldSendWechatToolAuthNotice(params.bridgeConfig, {
            state: "blocked",
            chatType: params.chatType,
        })) {
            return;
        }
        await params.sendWechatToolAuthNotice(
            params.api,
            {
                from: params.from,
                accountId: params.accountId || "default",
                messageId: params.messageId,
            },
            "当前来源无权限接收本地文件附件，请由主人微信发起。",
        );
    };
}

export function resolveWechatFallbackNoticeContextFromSessionKey(sessionKey?: string): WechatToolNoticeContext | null {
    const trimmed = sessionKey?.trim();
    if (!trimmed) {
        return null;
    }

    const fallbackAuth = getWechatToolAuthFallbackForSession(trimmed);
    if (fallbackAuth?.from) {
        return {
            from: fallbackAuth.from,
            accountId: fallbackAuth.accountId || "default",
            messageId: fallbackAuth.messageId,
            chatType: fallbackAuth.chatType,
            conversationLabel: fallbackAuth.conversationLabel,
            senderId: fallbackAuth.senderId,
            senderName: fallbackAuth.senderName,
            content: fallbackAuth.content,
        };
    }

    const marker = ":wechat:";
    const markerIndex = trimmed.indexOf(marker);
    if (markerIndex < 0) {
        return null;
    }

    const suffix = trimmed.slice(markerIndex + marker.length);
    const separatorIndex = suffix.indexOf(":");
    if (separatorIndex <= 0) {
        return null;
    }

    const chatTypeValue = suffix.slice(0, separatorIndex).trim();
    if (chatTypeValue !== "group" && chatTypeValue !== "direct") {
        return null;
    }

    const from = suffix.slice(separatorIndex + 1).trim();
    if (!from) {
        return null;
    }

    const chatType = chatTypeValue as "group" | "direct";
    return {
        from,
        accountId: "default",
        chatType,
        conversationLabel: from,
        senderId: chatType === "direct" ? from : undefined,
        senderName: chatType === "direct" ? from : undefined,
    };
}

export function shouldApplyWechatToolAuth(params: {
    sessionKey?: string;
    runId?: string;
}): boolean {
    const sessionKey = params.sessionKey?.trim();
    if (sessionKey?.includes(":wechat:")) {
        return true;
    }
    if (sessionKey && (
        getWechatToolAuthForSession(sessionKey) ||
        getWechatToolAuthFallbackForSession(sessionKey)
    )) {
        return true;
    }
    const runId = params.runId?.trim();
    if (runId && getWechatToolAuthForRun(runId)) {
        return true;
    }
    return false;
}
