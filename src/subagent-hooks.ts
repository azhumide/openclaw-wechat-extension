import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import {
    canonicalizeWechatActiveSubagentRuntimeOrigins,
    canonicalizeWechatCoreRuntimeChannelRegistries,
    canonicalizeWechatGlobalChannelRegistry,
    canonicalizeWechatSessionStoreRouteForConfig,
    canonicalizeWechatSubagentRegistryOrigins,
    normalizeWechatSubagentDeliveryOrigin,
} from "./canonicalization.js";
import { resolveWechatExtensionConfig } from "./config.js";
import { resolveWechatContextSessionKey } from "./message-tool.js";
import {
    clearWechatToolAuthForRun,
    clearWechatToolAuthForSession,
    inheritWechatToolAuthForChildSession,
} from "./runtime.js";
import {
    redactWechatTextForLogs,
    summarizeWechatTextForLog,
} from "./text.js";

export function registerWechatSubagentLifecycleHooks(api: OpenClawPluginApi): void {
    api.on("agent_end", (_event, ctx) => {
        if (ctx.runId) {
            clearWechatToolAuthForRun(ctx.runId);
        }
    }, { priority: 100 });

    api.on("subagent_spawning", async (event, ctx) => {
        canonicalizeWechatGlobalChannelRegistry(api, "subagent_spawning");
        const requesterSessionKey = resolveWechatContextSessionKey({
            sessionKey: ctx.requesterSessionKey,
            SessionKey: (ctx as Record<string, unknown>).RequesterSessionKey,
        });
        const normalized = normalizeWechatSubagentDeliveryOrigin({
            origin: event.requester,
            requesterSessionKey,
        });
        const cfg = api.runtime.config.current();
        await Promise.all([
            canonicalizeWechatCoreRuntimeChannelRegistries(api, "subagent_spawning"),
            canonicalizeWechatSessionStoreRouteForConfig({
                api,
                cfg: cfg as Record<string, unknown>,
                sessionKey: requesterSessionKey,
                reason: "subagent_spawning",
                force: Boolean(normalized),
            }),
            canonicalizeWechatActiveSubagentRuntimeOrigins({
                api,
                childSessionKey: event.childSessionKey,
                requesterSessionKey,
                reason: "subagent_spawning",
            }),
            canonicalizeWechatSubagentRegistryOrigins({
                api,
                childRunId: ctx.runId,
                requesterSessionKey,
                reason: "subagent_spawning",
            }),
        ]);
        if (!normalized) {
            return;
        }
        if (event.requester && typeof event.requester === "object") {
            event.requester.channel = normalized.origin.channel;
            event.requester.accountId = normalized.origin.accountId;
            event.requester.to = normalized.origin.to;
            if (normalized.origin.threadId != null) {
                event.requester.threadId = normalized.origin.threadId;
            }
        }
        if (normalized.changed) {
            const bridgeConfig = resolveWechatExtensionConfig(cfg, api.logger);
            api.logger.info(
                `[WeChat] Canonicalized subagent spawning origin child=${event.childSessionKey || ""}` +
                ` requester=${requesterSessionKey || ""}` +
                ` channel=${normalized.previousChannel || "missing"}->wechat` +
                ` to=${redactWechatTextForLogs(summarizeWechatTextForLog(normalized.origin.to || "", 120), bridgeConfig)}` +
                `${normalized.inferredFromSession ? " source=session-key" : ""}`,
            );
        }
        return {
            status: "ok" as const,
            deliveryOrigin: normalized.origin,
        };
    }, { priority: 10_000 });

    api.on("subagent_delivery_target", async (event, ctx) => {
        canonicalizeWechatGlobalChannelRegistry(api, "subagent_delivery_target");
        const normalized = normalizeWechatSubagentDeliveryOrigin({
            origin: event.requesterOrigin,
            requesterSessionKey: event.requesterSessionKey,
        });
        const cfg = api.runtime.config.current();
        await Promise.all([
            canonicalizeWechatCoreRuntimeChannelRegistries(api, "subagent_delivery_target"),
            canonicalizeWechatSessionStoreRouteForConfig({
                api,
                cfg: cfg as Record<string, unknown>,
                sessionKey: event.requesterSessionKey,
                reason: "subagent_delivery_target",
            }),
            canonicalizeWechatSubagentRegistryOrigins({
                api,
                childRunId: event.childRunId || ctx.runId,
                requesterSessionKey: event.requesterSessionKey,
                reason: "subagent_delivery_target",
            }),
            canonicalizeWechatActiveSubagentRuntimeOrigins({
                api,
                childRunId: event.childRunId || ctx.runId,
                childSessionKey: event.childSessionKey,
                requesterSessionKey: event.requesterSessionKey,
                reason: "subagent_delivery_target",
            }),
        ]);
        if (!normalized) {
            return;
        }
        if (event.requesterOrigin && typeof event.requesterOrigin === "object") {
            event.requesterOrigin.channel = normalized.origin.channel;
            event.requesterOrigin.accountId = normalized.origin.accountId;
            event.requesterOrigin.to = normalized.origin.to;
            if (normalized.origin.threadId != null) {
                event.requesterOrigin.threadId = normalized.origin.threadId;
            }
        }
        if (normalized.changed) {
            const bridgeConfig = resolveWechatExtensionConfig(cfg, api.logger);
            api.logger.info(
                `[WeChat] Canonicalized subagent delivery target runId=${ctx.runId || event.childRunId || ""}` +
                ` requester=${event.requesterSessionKey}` +
                ` channel=${normalized.previousChannel || "missing"}->wechat` +
                ` to=${redactWechatTextForLogs(summarizeWechatTextForLog(normalized.origin.to || "", 120), bridgeConfig)}` +
                `${normalized.inferredFromSession ? " source=session-key" : ""}`,
            );
        }
        return {
            origin: normalized.origin,
        };
    }, { priority: 10_000 });

    api.on("subagent_spawned", async (event, ctx) => {
        canonicalizeWechatGlobalChannelRegistry(api, "subagent_spawned");
        const requesterSessionKey = resolveWechatContextSessionKey({
            sessionKey: ctx.requesterSessionKey,
            SessionKey: (ctx as Record<string, unknown>).RequesterSessionKey,
        });
        const childSessionKey = resolveWechatContextSessionKey({
            sessionKey: ctx.childSessionKey,
            SessionKey: (ctx as Record<string, unknown>).ChildSessionKey,
        });
        if (!childSessionKey || !requesterSessionKey) {
            return;
        }
        const cfg = api.runtime.config.current();
        await Promise.all([
            canonicalizeWechatCoreRuntimeChannelRegistries(api, "subagent_spawned"),
            canonicalizeWechatSessionStoreRouteForConfig({
                api,
                cfg: cfg as Record<string, unknown>,
                sessionKey: requesterSessionKey,
                reason: "subagent_spawned:requester",
            }),
            canonicalizeWechatSessionStoreRouteForConfig({
                api,
                cfg: cfg as Record<string, unknown>,
                sessionKey: childSessionKey,
                reason: "subagent_spawned:child",
                force: true,
            }),
            canonicalizeWechatSubagentRegistryOrigins({
                api,
                childRunId: event.runId || ctx.runId,
                requesterSessionKey,
                reason: "subagent_spawned",
            }),
            canonicalizeWechatActiveSubagentRuntimeOrigins({
                api,
                childRunId: event.runId || ctx.runId,
                childSessionKey,
                requesterSessionKey,
                reason: "subagent_spawned",
            }),
        ]);
        inheritWechatToolAuthForChildSession({
            requesterSessionKey,
            childSessionKey,
        });
    }, { priority: 10_000 });

    api.on("session_end", (_event, ctx) => {
        const sessionKey = resolveWechatContextSessionKey(ctx as Record<string, unknown>);
        if (sessionKey) {
            clearWechatToolAuthForSession(sessionKey);
        }
    }, { priority: 100 });
}
