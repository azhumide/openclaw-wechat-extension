import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { resolveWechatExtensionConfig } from "./config.js";
import {
    getWechatToolAuthFallbackForSession,
    markWechatBlockedReplyForSession,
    summarizeWechatToolAuthDebugState,
} from "./runtime.js";
import {
    buildWechatToolApprovalDescription,
    buildWechatToolNoticeText,
    resolveWechatFallbackNoticeContextFromSessionKey,
    shouldSendWechatToolAuthNotice,
    type SendWechatToolAuthNotice,
    type WechatToolNoticeState,
} from "./tool-auth-notice.js";

export type ClaimWechatToolAuthLogDedup = (params: {
    kind: string;
    runId?: string;
    toolName?: string;
    skillId?: string;
    detail?: string;
}) => boolean;

export function handleWechatMissingToolAuthContext(params: {
    api: OpenClawPluginApi;
    bridgeConfig: ReturnType<typeof resolveWechatExtensionConfig>;
    toolName: string;
    effectiveRunId?: string;
    effectiveSessionKey?: string;
    claimWechatToolAuthLogDedup: ClaimWechatToolAuthLogDedup;
    sendWechatToolAuthNotice: SendWechatToolAuthNotice;
}): void | {
    block: true;
    blockReason: string;
} {
    const debugSummary = summarizeWechatToolAuthDebugState({
        sessionKey: params.effectiveSessionKey,
        runId: params.effectiveRunId,
    });
    if (params.claimWechatToolAuthLogDedup({
        kind: "missing-auth-context",
        runId: params.effectiveRunId,
        toolName: params.toolName,
        detail: debugSummary,
    })) {
        params.api.logger.error?.(
            `[WeChat ToolAuth] Blocking guarded tool because auth context is missing tool=${params.toolName} ${debugSummary}`,
        );
    }

    if (params.bridgeConfig.nonOwnerToolAuthMode === "off") {
        return;
    }

    const recordedFallbackAuth = params.effectiveSessionKey
        ? getWechatToolAuthFallbackForSession(params.effectiveSessionKey)
        : undefined;
    const fallbackNoticeContext = recordedFallbackAuth
        ? resolveWechatFallbackNoticeContextFromSessionKey(params.effectiveSessionKey)
        : null;
    const sentBlockedNotice = Boolean(
        fallbackNoticeContext && shouldSendWechatToolAuthNotice(params.bridgeConfig, {
            state: "blocked",
            chatType: fallbackNoticeContext.chatType,
        }),
    );
    if (fallbackNoticeContext && sentBlockedNotice) {
        void params.sendWechatToolAuthNotice(
            params.api,
            fallbackNoticeContext,
            buildWechatToolNoticeText({
                toolName: params.toolName,
                state: "blocked",
                authContext: fallbackNoticeContext,
                config: params.bridgeConfig,
            }),
        );
    } else if (!fallbackNoticeContext) {
        const missingNoticeDetail = recordedFallbackAuth
            ? params.effectiveSessionKey || ""
            : `${params.effectiveSessionKey || ""}|synthetic-suppressed`;
        if (params.claimWechatToolAuthLogDedup({
            kind: "missing-auth-context-no-notice-context",
            runId: params.effectiveRunId,
            toolName: params.toolName,
            detail: missingNoticeDetail,
        })) {
            params.api.logger.warn?.(
                recordedFallbackAuth
                    ? `[WeChat ToolAuth] Missing auth context and could not resolve fallback notice context tool=${params.toolName} sessionKey=${params.effectiveSessionKey || ""} runId=${params.effectiveRunId || ""}`
                    : `[WeChat ToolAuth] Missing auth context for guarded tool; suppressing synthetic fallback notice tool=${params.toolName} sessionKey=${params.effectiveSessionKey || ""} runId=${params.effectiveRunId || ""}`,
            );
        }
    }

    if (params.effectiveSessionKey) {
        markWechatBlockedReplyForSession({
            sessionKey: params.effectiveSessionKey,
            toolName: params.toolName,
            reason: "missing-auth-context",
            noticeSent: sentBlockedNotice,
        });
    }

    return {
        block: true,
        blockReason: `WeChat tool auth context missing for guarded tool ${params.toolName}; refusing to continue. Please politely inform the user that execution cannot proceed.`,
    };
}

export function handleWechatBlockedSkillToolAuth(params: {
    api: OpenClawPluginApi;
    bridgeConfig: ReturnType<typeof resolveWechatExtensionConfig>;
    toolName: string;
    effectiveRunId?: string;
    effectiveSessionKey?: string;
    blockedSkillId: string;
    installedSkillSummary: string;
    authSummary: string;
    authContext: {
        from?: string;
        accountId?: string;
        messageId?: string;
        chatType?: "group" | "direct";
        senderId?: string;
        skillId?: string;
        [key: string]: unknown;
    };
    claimWechatToolAuthLogDedup: ClaimWechatToolAuthLogDedup;
    sendWechatToolAuthNotice: SendWechatToolAuthNotice;
}): {
    block: true;
    blockReason: string;
} {
    if (params.claimWechatToolAuthLogDedup({
        kind: "blocked-blacklisted-skill",
        runId: params.effectiveRunId,
        toolName: params.toolName,
        skillId: params.blockedSkillId,
        detail: params.installedSkillSummary,
    })) {
        params.api.logger.warn(
            `[WeChat ToolAuth] Blocked blacklisted skill tool=${params.toolName} runId=${params.effectiveRunId || ""} skill=${params.blockedSkillId}${params.installedSkillSummary ? ` ${params.installedSkillSummary}` : ""} ${params.authSummary}`,
        );
    }
    const sentBlockedNotice = shouldSendWechatToolAuthNotice(params.bridgeConfig, {
        state: "blocked",
        chatType: params.authContext.chatType,
    });
    if (sentBlockedNotice) {
        void params.sendWechatToolAuthNotice(
            params.api,
            {
                ...params.authContext,
                skillId: params.blockedSkillId,
            },
            buildWechatToolNoticeText({
                toolName: params.toolName,
                state: "blocked",
                authContext: {
                    ...params.authContext,
                    skillId: params.blockedSkillId,
                },
                config: params.bridgeConfig,
            }),
        );
    }
    if (params.effectiveSessionKey) {
        markWechatBlockedReplyForSession({
            sessionKey: params.effectiveSessionKey,
            toolName: params.toolName,
            reason: "blocked-skill",
            noticeSent: sentBlockedNotice,
        });
    }
    return {
        block: true,
        blockReason: `WeChat sender ${params.authContext.senderId || "unknown"} is not authorized to use blocked skill ${params.blockedSkillId} via ${params.toolName}. Please politely inform the user that they do not have permission.`,
    };
}

export function handleWechatDeniedToolAuth(params: {
    api: OpenClawPluginApi;
    bridgeConfig: ReturnType<typeof resolveWechatExtensionConfig>;
    toolName: string;
    effectiveRunId?: string;
    effectiveSessionKey?: string;
    authSummary: string;
    authContext: {
        from?: string;
        accountId?: string;
        messageId?: string;
        chatType?: "group" | "direct";
        senderId?: string;
        [key: string]: unknown;
    };
    modelReason?: string;
    claimWechatToolAuthLogDedup: ClaimWechatToolAuthLogDedup;
    sendWechatToolAuthNotice: SendWechatToolAuthNotice;
}): {
    block: true;
    blockReason: string;
} {
    if (params.claimWechatToolAuthLogDedup({
        kind: "denied-tool",
        runId: params.effectiveRunId,
        toolName: params.toolName,
        detail: params.authContext.chatType || "",
    })) {
        params.api.logger.warn(
            `[WeChat ToolAuth] Denied tool=${params.toolName} runId=${params.effectiveRunId || ""} ${params.authSummary}`,
        );
    }
    const sentBlockedNotice = shouldSendWechatToolAuthNotice(params.bridgeConfig, {
        state: "blocked",
        chatType: params.authContext.chatType,
    });
    if (sentBlockedNotice) {
        void params.sendWechatToolAuthNotice(
            params.api,
            params.authContext,
            buildWechatToolNoticeText({
                toolName: params.toolName,
                state: "blocked",
                authContext: params.authContext,
                config: params.bridgeConfig,
            }),
        );
    }
    if (params.effectiveSessionKey) {
        markWechatBlockedReplyForSession({
            sessionKey: params.effectiveSessionKey,
            toolName: params.toolName,
            reason: "non-owner-deny",
            noticeSent: sentBlockedNotice,
        });
    }
    const modelReason = params.modelReason?.trim()
        ? ` The blocked call was rejected because ${params.modelReason.trim()}.`
        : "";
    return {
        block: true,
        blockReason: `WeChat sender ${params.authContext.senderId || "unknown"} is not authorized to use ${params.toolName}.${modelReason} Please politely explain this permission policy to the user; do not retry the blocked action or claim it succeeded.`,
    };
}

export function handleWechatApprovalToolAuth(params: {
    api: OpenClawPluginApi;
    bridgeConfig: ReturnType<typeof resolveWechatExtensionConfig>;
    toolName: string;
    effectiveRunId?: string;
    contextRunId?: string;
    authSummary: string;
    authContext: {
        from?: string;
        accountId?: string;
        messageId?: string;
        chatType?: "group" | "direct";
        senderId?: string;
        [key: string]: unknown;
    };
    eventParams?: unknown;
    sendWechatToolAuthNotice: SendWechatToolAuthNotice;
}): {
    params: unknown;
    requireApproval: {
        title: string;
        description: string;
        severity: "critical" | "warning";
        timeoutMs: number;
        timeoutBehavior: "deny";
        onResolution: (decision: string) => void;
    };
} {
    params.api.logger.warn(
        `[WeChat ToolAuth] Approval required tool=${params.toolName} runId=${params.effectiveRunId || ""} ${params.authSummary}`,
    );
    if (shouldSendWechatToolAuthNotice(params.bridgeConfig, {
        state: "queued",
        chatType: params.authContext.chatType,
    })) {
        void params.sendWechatToolAuthNotice(
            params.api,
            params.authContext,
            buildWechatToolNoticeText({
                toolName: params.toolName,
                state: "queued",
                authContext: params.authContext,
                config: params.bridgeConfig,
            }),
        );
    }
    return {
        params:
            params.toolName === "exec"
                ? {
                    ...(params.eventParams && typeof params.eventParams === "object"
                        ? params.eventParams as Record<string, unknown>
                        : {}),
                    ask: "off",
                }
                : params.eventParams,
        requireApproval: {
            title: `Approve WeChat ${params.toolName}`,
            description: buildWechatToolApprovalDescription(params.toolName, params.authContext),
            severity: params.toolName === "exec" ? "critical" : "warning",
            timeoutMs: 120000,
            timeoutBehavior: "deny",
            onResolution: (decision) => {
                params.api.logger.info(
                    `[WeChat ToolAuth] Approval resolved tool=${params.toolName} runId=${params.contextRunId} decision=${decision} ${params.authSummary}`,
                );
                const resolvedState: WechatToolNoticeState =
                    decision === "allow-once" ||
                    decision === "allow-always" ||
                    decision === "deny" ||
                    decision === "timeout" ||
                    decision === "cancelled"
                        ? decision
                        : "cancelled";
                if (shouldSendWechatToolAuthNotice(params.bridgeConfig, {
                    state: resolvedState,
                    chatType: params.authContext.chatType,
                })) {
                    void params.sendWechatToolAuthNotice(
                        params.api,
                        params.authContext,
                        buildWechatToolNoticeText({
                            toolName: params.toolName,
                            state: resolvedState,
                            authContext: params.authContext,
                            config: params.bridgeConfig,
                        }),
                    );
                }
            },
        },
    };
}
