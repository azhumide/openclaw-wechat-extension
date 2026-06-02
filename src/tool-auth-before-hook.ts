import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import {
    canonicalWechatChannelId,
    canonicalizeWechatCoreRuntimeChannelRegistries,
    canonicalizeWechatGlobalChannelRegistry,
    canonicalizeWechatSessionStoreRouteForConfig,
} from "./canonicalization.js";
import type { resolveWechatExtensionConfig } from "./config.js";
import {
    handleWechatApprovalToolAuth,
    handleWechatBlockedSkillToolAuth,
    handleWechatDeniedToolAuth,
    handleWechatMissingToolAuthContext,
    type ClaimWechatToolAuthLogDedup,
} from "./tool-auth-missing-context.js";
import {
    buildWechatDeniedToolAuthModelReason,
    logWechatInstalledSkillDebugIfNeeded,
    maybeBypassWechatSafeReadonlyExec,
    maybeHandleWechatTrustedToolBypass,
    resolveWechatInstalledSkillAuthState,
} from "./tool-auth-installed-skill.js";
import {
    buildWechatToolAuthFromContext,
    normalizeWechatMessageToolCall,
    resolveWechatContextBody,
    resolveWechatContextChannelAlias,
    resolveWechatContextSenderId,
    resolveWechatContextSessionKey,
} from "./message-tool.js";
import {
    getWechatToolSpecificAllowList,
    normalizeGuardedToolNameList,
    normalizeWechatIdAllowList,
    normalizeWechatSkillIdList,
    resolveWechatMcporterExecBypass,
    resolveWechatSafeDownloadExecBypass,
    resolveWechatSystemSafePathBypass,
    resolveWechatToolBypassMatch,
} from "./tool-auth-policy.js";
import {
    bindWechatToolAuthToRun,
    getWechatToolAuthFallbackForSession,
    getWechatToolAuthForRun,
    getWechatToolAuthForSession,
    summarizeWechatToolAuthDebugState,
} from "./runtime.js";
import {
    isWechatLogRecord,
    summarizeWechatToolAuthRecord,
    summarizeWechatToolParamsForLog,
} from "./tool-log.js";
import {
    shouldApplyWechatToolAuth,
    type SendWechatToolAuthNotice,
} from "./tool-auth-notice.js";
import { summarizeWechatTextForLog } from "./text.js";

function tryBindWechatToolAuthForRun(params: {
    api: OpenClawPluginApi;
    ctx: Record<string, unknown> | undefined;
    hookName: string;
    runId?: string;
}) {
    const sessionKey = resolveWechatContextSessionKey(params.ctx);
    const runId = params.runId?.trim() ||
        (typeof params.ctx?.runId === "string" && params.ctx.runId.trim() ? params.ctx.runId.trim() : "");
    if (!runId || !sessionKey) {
        return;
    }

    const existingRunAuth = getWechatToolAuthForRun(runId);
    if (existingRunAuth) {
        return existingRunAuth;
    }

    const boundAuth = bindWechatToolAuthToRun({
        sessionKey,
        runId,
    });
    if (boundAuth) {
        params.api.logger.debug?.(
            `[WeChat ToolAuth] Bound auth to run via ${params.hookName} ${summarizeWechatToolAuthDebugState({
                sessionKey,
                runId,
            })}`,
        );
        return boundAuth;
    }

    if (shouldApplyWechatToolAuth({ sessionKey, runId })) {
        const existingSessionAuth = getWechatToolAuthForSession(sessionKey);
        const debugState = summarizeWechatToolAuthDebugState({
            sessionKey,
            runId,
        });
        if (existingSessionAuth) {
            params.api.logger.debug?.(
                `[WeChat ToolAuth] Bind to run skipped via ${params.hookName} because auth context is already available source=session ${debugState}`,
            );
        } else {
            params.api.logger.debug?.(
                `[WeChat ToolAuth] Failed to bind auth to run via ${params.hookName} ${debugState}`,
            );
        }
    }

    return;
}

function buildWechatPermissionPromptContext(params: {
    cfg: Record<string, unknown>;
    ctx: Record<string, unknown> | undefined;
    resolveConfig: typeof resolveWechatExtensionConfig;
    logger: OpenClawPluginApi["logger"];
}): string | undefined {
    const sessionKey = resolveWechatContextSessionKey(params.ctx);
    if (!shouldApplyWechatToolAuth({ sessionKey })) {
        return undefined;
    }

    const bridgeConfig = params.resolveConfig(params.cfg, params.logger);
    const runId = typeof params.ctx?.runId === "string" && params.ctx.runId.trim()
        ? params.ctx.runId.trim()
        : "";
    const authContext =
        (runId ? getWechatToolAuthForRun(runId) : undefined) ||
        (sessionKey ? getWechatToolAuthForSession(sessionKey) : undefined) ||
        (sessionKey ? getWechatToolAuthFallbackForSession(sessionKey) : undefined) ||
        (sessionKey
            ? buildWechatToolAuthFromContext({
                ctx: params.ctx,
                sessionKey,
                senderId: resolveWechatContextSenderId(params.ctx),
                content: resolveWechatContextBody(params.ctx),
            })
            : undefined);
    if (!authContext) {
        return undefined;
    }

    const bypassMatch = resolveWechatToolBypassMatch(
        normalizeWechatIdAllowList(bridgeConfig.toolAuthBypassWxids),
        authContext,
    );
    if (authContext.isMaster || bypassMatch.matched) {
        return undefined;
    }

    const guardedTools = [...normalizeGuardedToolNameList(bridgeConfig.nonOwnerToolAuthTools)].sort();
    const senderLabel = authContext.senderName && authContext.senderName !== authContext.senderId
        ? `${authContext.senderName} (${authContext.senderId || "unknown"})`
        : (authContext.senderId || authContext.senderName || "unknown");
    const location = authContext.chatType === "group"
        ? `group chat ${authContext.conversationLabel || authContext.from || "unknown"}`
        : "direct chat";

    const lines = [
        "[OpenClaw WeChat permission context]",
        `Current WeChat sender ${senderLabel} in ${location} is not the owner and is not in the tool/file bypass allowlist.`,
        "Do not claim that a blocked action succeeded.",
        "Do not preemptively refuse image or media generation just because the result is stored as a local file; common safe media attachments such as images can be delivered after the channel's delivery checks pass.",
        `When you need to download a remote/generated media URL for WeChat delivery, use the safe download form wget -O ${bridgeConfig.workspaceBase}/downloads/<filename> <url> or curl -L -o ${bridgeConfig.workspaceBase}/downloads/<filename> <url>; do not use python -c, inline scripts, or general shell pipelines for downloads.`,
        "If a guarded tool call or local attachment delivery is actually blocked by the system, explain the permission policy in the user's language instead of retrying or pretending it succeeded. For non-media local host files, offer to summarize the content or ask the owner to initiate the request.",
    ];
    if (bridgeConfig.nonOwnerToolAuthMode !== "off" && guardedTools.length > 0) {
        lines.push(
            `Guarded tools for this sender: ${guardedTools.join(", ")}. If one is blocked or not approved, explain the permission policy instead of retrying or pretending the operation completed.`,
        );
    }
    return lines.join("\n");
}

export function registerWechatToolAuthBeforeHooks(params: {
    api: OpenClawPluginApi;
    resolveWechatExtensionConfig: typeof resolveWechatExtensionConfig;
    claimWechatToolAuthLogDedup: ClaimWechatToolAuthLogDedup;
    sendWechatToolAuthNotice: SendWechatToolAuthNotice;
}): void {
    const {
        api,
        resolveWechatExtensionConfig: resolveConfig,
        claimWechatToolAuthLogDedup,
        sendWechatToolAuthNotice,
    } = params;

    api.on("before_model_resolve", (_event, ctx) => {
        tryBindWechatToolAuthForRun({
            api,
            ctx: ctx as Record<string, unknown>,
            hookName: "before_model_resolve",
        });
        return;
    }, { priority: 10_000 });

    api.on("before_prompt_build", (_event, ctx) => {
        tryBindWechatToolAuthForRun({
            api,
            ctx: ctx as Record<string, unknown>,
            hookName: "before_prompt_build",
        });
        const appendSystemContext = buildWechatPermissionPromptContext({
            cfg: api.runtime.config.current() as Record<string, unknown>,
            ctx: ctx as Record<string, unknown>,
            resolveConfig,
            logger: api.logger,
        });
        return appendSystemContext ? { appendSystemContext } : undefined;
    }, { priority: 10_000 });

    api.on("before_agent_start", (_event, ctx) => {
        tryBindWechatToolAuthForRun({
            api,
            ctx: ctx as Record<string, unknown>,
            hookName: "before_agent_start",
            runId: ctx.runId,
        });
        return;
    }, { priority: 100 });

    api.on("before_tool_call", async (event, ctx) => {
        const cfg = api.runtime.config.current();
        const bridgeConfig = resolveConfig(cfg, api.logger);
        const guardedTools = normalizeGuardedToolNameList(bridgeConfig.nonOwnerToolAuthTools);
        const bypassWxids = normalizeWechatIdAllowList(bridgeConfig.toolAuthBypassWxids);
        const blockedSkills = normalizeWechatSkillIdList(bridgeConfig.toolAuthBlockedSkills);
        const toolName = event.toolName.trim().toLowerCase();
        const toolSpecificBypassWxids = getWechatToolSpecificAllowList(bridgeConfig, toolName);
        const effectiveRunId = ctx.runId?.trim() || event.runId?.trim();
        const effectiveSessionKey = resolveWechatContextSessionKey(ctx as Record<string, unknown>);
        const preliminaryRunAuth = effectiveRunId ? getWechatToolAuthForRun(effectiveRunId) : undefined;
        const preliminarySessionAuth = effectiveSessionKey ? getWechatToolAuthForSession(effectiveSessionKey) : undefined;
        const preliminaryFallbackAuth = effectiveSessionKey ? getWechatToolAuthFallbackForSession(effectiveSessionKey) : undefined;
        const preliminaryContextAuth = effectiveSessionKey
            ? buildWechatToolAuthFromContext({
                ctx: ctx as Record<string, unknown>,
                sessionKey: effectiveSessionKey,
                senderId: resolveWechatContextSenderId(ctx as Record<string, unknown>, event.senderId),
                content: resolveWechatContextBody(ctx as Record<string, unknown>, event.body || event.content),
            })
            : undefined;
        const preliminaryWechatAuth =
            preliminaryRunAuth ||
            preliminarySessionAuth ||
            preliminaryFallbackAuth ||
            preliminaryContextAuth;
        const hasWechatMessageContext = Boolean(
            effectiveSessionKey?.includes(":wechat:") ||
            preliminaryWechatAuth ||
            resolveWechatContextChannelAlias(ctx as Record<string, unknown>) ||
            (event.params && typeof event.params === "object" && canonicalWechatChannelId((event.params as Record<string, unknown>).channel)),
        );
        if (effectiveSessionKey && (effectiveSessionKey.includes(":wechat:") || preliminaryWechatAuth)) {
            void canonicalizeWechatSessionStoreRouteForConfig({
                api,
                cfg: cfg as Record<string, unknown>,
                sessionKey: effectiveSessionKey,
                reason: "before_tool_call",
                force: Boolean(preliminaryWechatAuth),
            });
        }

        if (
            toolName === "message" &&
            hasWechatMessageContext &&
            event.params &&
            typeof event.params === "object"
        ) {
            canonicalizeWechatGlobalChannelRegistry(api, "before_message_tool_call");
            await canonicalizeWechatCoreRuntimeChannelRegistries(api, "before_message_tool_call");
            const normalizedMessageTool = normalizeWechatMessageToolCall({
                rawParams: event.params as Record<string, unknown>,
                ctx: ctx as Record<string, unknown>,
                sessionKey: effectiveSessionKey,
                senderId: resolveWechatContextSenderId(ctx as Record<string, unknown>, event.senderId),
                authContext: preliminaryWechatAuth
                    ? {
                        from: preliminaryWechatAuth.from,
                        chatType: preliminaryWechatAuth.chatType,
                        senderId: preliminaryWechatAuth.senderId,
                    }
                    : undefined,
                logger: api.logger,
            });
            if (normalizedMessageTool.kind === "block") {
                return {
                    block: true,
                    blockReason: normalizedMessageTool.blockReason,
                };
            }

            if (normalizedMessageTool.kind === "params") {
                const rawParams = event.params as Record<string, unknown>;
                for (const key of Object.keys(rawParams)) {
                    if (!(key in normalizedMessageTool.params)) {
                        delete rawParams[key];
                    }
                }
                Object.assign(rawParams, normalizedMessageTool.params);
                return {
                    params: rawParams,
                };
            }
        }

        if (!shouldApplyWechatToolAuth({
            sessionKey: effectiveSessionKey,
            runId: effectiveRunId,
        })) {
            return;
        }
        let runBoundAuth = effectiveRunId ? getWechatToolAuthForRun(effectiveRunId) : undefined;
        let sessionBoundAuth = effectiveSessionKey ? getWechatToolAuthForSession(effectiveSessionKey) : undefined;
        if (!runBoundAuth && !sessionBoundAuth && effectiveRunId && effectiveSessionKey) {
            runBoundAuth = tryBindWechatToolAuthForRun({
                api,
                ctx: ctx as Record<string, unknown>,
                hookName: "before_tool_call",
                runId: effectiveRunId,
            });
            sessionBoundAuth = effectiveSessionKey ? getWechatToolAuthForSession(effectiveSessionKey) : undefined;
        }
        let authContext = runBoundAuth ?? sessionBoundAuth;
        let authContextSource: "run" | "session" | "chat" | "context" | undefined =
            runBoundAuth ? "run" : (sessionBoundAuth ? "session" : undefined);
        if (!authContext && effectiveSessionKey) {
            const fallbackAuthContext = getWechatToolAuthFallbackForSession(effectiveSessionKey);
            if (fallbackAuthContext) {
                authContext = fallbackAuthContext;
                authContextSource = "chat";
                api.logger.warn?.(
                    `[WeChat ToolAuth] Recovered auth context via chat fallback tool=${toolName} sessionKey=${effectiveSessionKey} runId=${effectiveRunId || ""} ` +
                    `${summarizeWechatToolAuthRecord(fallbackAuthContext)}`,
                );
            }
        }
        if (!authContext && effectiveSessionKey) {
            const contextAuth = buildWechatToolAuthFromContext({
                ctx: ctx as Record<string, unknown>,
                sessionKey: effectiveSessionKey,
                senderId: resolveWechatContextSenderId(ctx as Record<string, unknown>, event.senderId),
                content: resolveWechatContextBody(ctx as Record<string, unknown>, event.body || event.content),
            });
            if (contextAuth) {
                authContext = contextAuth;
                authContextSource = "context";
                api.logger.warn?.(
                    `[WeChat ToolAuth] Recovered auth context from current hook ctx tool=${toolName} ` +
                    `sessionKey=${effectiveSessionKey} runId=${effectiveRunId || ""} ` +
                    `${summarizeWechatToolAuthRecord(contextAuth)}`,
                );
            }
        }
        const paramsSummary = summarizeWechatToolParamsForLog(
            toolName,
            isWechatLogRecord(event.params) ? event.params : undefined,
        );

        if (toolName === "web_fetch" && authContext) {
            api.logger.info(
                `[WeChat ToolTrace] tool=${toolName} phase=before runId=${effectiveRunId || ""} ${paramsSummary} ${summarizeWechatToolAuthRecord(authContext)}`,
            );
        }

        if (guardedTools.has(toolName) && !effectiveRunId) {
            api.logger.warn?.(
                `[WeChat ToolAuth] Guarded tool missing runId tool=${toolName} ${summarizeWechatToolAuthDebugState({
                    sessionKey: effectiveSessionKey,
                    runId: event.runId,
                })}`,
            );
        }

        if (guardedTools.has(toolName) && authContext && authContextSource !== "run") {
            api.logger.warn?.(
                `[WeChat ToolAuth] Guarded tool using ${authContextSource || "unknown"} fallback tool=${toolName} sessionKey=${effectiveSessionKey || ""} runId=${effectiveRunId || ""}`,
            );
        }

        if (!guardedTools.has(toolName)) {
            return;
        }

        const systemSafeBypass = resolveWechatSystemSafePathBypass({
            toolName,
            rawPath: (event.params as any)?.path,
        });
        if (systemSafeBypass.matched) {
            api.logger.info(
                `[WeChat ToolAuth] System-safe path bypass tool=${toolName} path="${systemSafeBypass.targetPath}" session=${effectiveSessionKey || ""}`,
            );
            return;
        }

        if (!authContext) {
            return handleWechatMissingToolAuthContext({
                api,
                bridgeConfig,
                toolName,
                effectiveRunId,
                effectiveSessionKey,
                claimWechatToolAuthLogDedup,
                sendWechatToolAuthNotice,
            });
        }

        const authSummary = summarizeWechatToolAuthRecord(authContext);
        const allowBypassForAuthContext =
            authContext.isMaster || authContextSource === "run" || authContextSource === "context";
        const generalBypassMatch = allowBypassForAuthContext
            ? resolveWechatToolBypassMatch(bypassWxids, authContext)
            : { matched: false };
        const toolSpecificBypassMatch = allowBypassForAuthContext
            ? resolveWechatToolBypassMatch(toolSpecificBypassWxids, authContext)
            : { matched: false };
        const bypassMatch = generalBypassMatch.matched ? generalBypassMatch : toolSpecificBypassMatch;
        const bypassSource = generalBypassMatch.matched
            ? "whitelist-global"
            : (toolSpecificBypassMatch.matched ? `whitelist-tool:${toolName}` : undefined);
        const isBypassWxid = bypassMatch.matched;
        const installedSkillState = resolveWechatInstalledSkillAuthState({
            toolName,
            eventParams: event.params,
            bridgeConfig,
            blockedSkills,
        });
        const {
            execCommand,
            isInstalledSkillProcessSession,
            isInstalledSkillBypass,
            blockedSkillId,
            installedSkillMatch,
            installedSkillSummary,
        } = installedSkillState;

        const safeReadonlyExecBypass = maybeBypassWechatSafeReadonlyExec({
            api,
            toolName,
            effectiveRunId,
            bridgeConfig,
            authSummary,
            authContext,
            isBypassWxid,
            isInstalledSkillBypass,
            execCommand,
            execWorkdir: installedSkillState.execWorkdir,
            eventParams: event.params,
        });
        if (safeReadonlyExecBypass) {
            return safeReadonlyExecBypass;
        }

        logWechatInstalledSkillDebugIfNeeded({
            api,
            bridgeConfig,
            toolName,
            effectiveRunId,
            contextRunId: ctx.runId,
            authSummary,
            state: installedSkillState,
            claimWechatToolAuthLogDedup,
        });

        if (!authContext.isMaster && !isBypassWxid && blockedSkillId) {
            return handleWechatBlockedSkillToolAuth({
                api,
                bridgeConfig,
                toolName,
                effectiveRunId,
                effectiveSessionKey,
                blockedSkillId,
                installedSkillSummary,
                authSummary,
                authContext,
                claimWechatToolAuthLogDedup,
                sendWechatToolAuthNotice,
            });
        }

        const trustedBypass = maybeHandleWechatTrustedToolBypass({
            api,
            toolName,
            effectiveRunId,
            eventParams: event.params,
            bridgeConfig,
            authContext,
            authSummary,
            isBypassWxid,
            bypassSource,
            bypassMatch,
            isInstalledSkillBypass,
            isInstalledSkillProcessSession,
            installedSkillReason: installedSkillMatch.reason,
            installedSkillSummary,
        });
        if (trustedBypass?.handled) {
            return trustedBypass.result;
        }

        const safeDownloadBypass = resolveWechatSafeDownloadExecBypass({
            toolName,
            command: execCommand,
            workspaceBase: bridgeConfig.workspaceBase,
        });
        if (safeDownloadBypass.matched) {
            api.logger.info(
                `[WeChat ToolAuth] Safe-download bypass tool=exec segments=${safeDownloadBypass.segmentCount || 0} ` +
                `target="${summarizeWechatTextForLog(safeDownloadBypass.firstSegment || "", 120)}" ${authSummary}`,
            );
            return {
                params: {
                    ...(event.params && typeof event.params === "object" ? event.params as Record<string, unknown> : {}),
                    ask: "off",
                },
            };
        }

        const mcporterBypass = resolveWechatMcporterExecBypass({
            toolName,
            command: execCommand,
            allowMcporterExec: bridgeConfig.toolAuthAllowMcporterExec,
        });
        if (mcporterBypass.matched) {
            api.logger.info(
                `[WeChat ToolAuth] MCP CLI bypass tool=exec command=mcporter ` +
                `segment="${summarizeWechatTextForLog(mcporterBypass.normalized || execCommand || "", 120)}" ${authSummary}`,
            );
            return {
                params: {
                    ...(event.params && typeof event.params === "object" ? event.params as Record<string, unknown> : {}),
                    ask: "off",
                },
            };
        }

        if (bridgeConfig.nonOwnerToolAuthMode === "deny") {
            return handleWechatDeniedToolAuth({
                api,
                bridgeConfig,
                toolName,
                effectiveRunId,
                effectiveSessionKey,
                authSummary,
                authContext,
                modelReason: buildWechatDeniedToolAuthModelReason({
                    toolName,
                    bridgeConfig,
                    state: installedSkillState,
                }),
                claimWechatToolAuthLogDedup,
                sendWechatToolAuthNotice,
            });
        }

        if (bridgeConfig.nonOwnerToolAuthMode === "approve") {
            return handleWechatApprovalToolAuth({
                api,
                bridgeConfig,
                toolName,
                effectiveRunId,
                contextRunId: ctx.runId,
                authSummary,
                authContext,
                eventParams: event.params,
                sendWechatToolAuthNotice,
            });
        }

        return;
    }, { priority: 10_000 });

    api.on("before_tool_call", async (event, ctx) => {
        const toolName = event.toolName.trim().toLowerCase();
        if (
            toolName !== "message" ||
            !event.params ||
            typeof event.params !== "object"
        ) {
            return;
        }

        const effectiveSessionKey = resolveWechatContextSessionKey(ctx as Record<string, unknown>);
        const hasWechatMessageContext = Boolean(
            effectiveSessionKey?.includes(":wechat:") ||
            resolveWechatContextChannelAlias(ctx as Record<string, unknown>) ||
            canonicalWechatChannelId((event.params as Record<string, unknown>).channel),
        );
        if (!hasWechatMessageContext) {
            return;
        }

        canonicalizeWechatGlobalChannelRegistry(api, "before_message_tool_call_final");
        await canonicalizeWechatCoreRuntimeChannelRegistries(api, "before_message_tool_call_final");
        const normalizedMessageTool = normalizeWechatMessageToolCall({
            rawParams: event.params as Record<string, unknown>,
            ctx: ctx as Record<string, unknown>,
            sessionKey: effectiveSessionKey,
            senderId: resolveWechatContextSenderId(ctx as Record<string, unknown>, event.senderId),
            logger: api.logger,
        });
        if (normalizedMessageTool.kind === "block") {
            return {
                block: true,
                blockReason: normalizedMessageTool.blockReason,
            };
        }
        if (normalizedMessageTool.kind !== "params") {
            return;
        }

        const rawParams = event.params as Record<string, unknown>;
        for (const key of Object.keys(rawParams)) {
            if (!(key in normalizedMessageTool.params)) {
                delete rawParams[key];
            }
        }
        Object.assign(rawParams, normalizedMessageTool.params);
        return {
            params: rawParams,
        };
    }, { priority: -10_000 });
}
