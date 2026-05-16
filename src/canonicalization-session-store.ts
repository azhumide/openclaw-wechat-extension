import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import {
    resolveSessionStoreEntry,
    updateSessionStore,
} from "openclaw/plugin-sdk/session-store-runtime";
import { withPatchedWechatLegacyChannelFields } from "./canonicalization-legacy-fields.js";
import { parseWechatDeliveryRouteFromSessionKey } from "./canonicalization-origin.js";
import { summarizeWechatTextForLog } from "./text.js";

async function canonicalizeWechatSessionStoreRoute(params: {
    api: OpenClawPluginApi;
    storePath: string;
    sessionKey: string;
}) {
    await updateSessionStore(
        params.storePath,
        (store) => {
            const resolved = resolveSessionStoreEntry({
                store,
                sessionKey: params.sessionKey,
            });
            const existing = resolved.existing;
            if (!existing) {
                return null;
            }
            const patched = withPatchedWechatLegacyChannelFields(existing);
            if (!patched.changed && resolved.legacyKeys.length === 0) {
                return existing;
            }
            store[resolved.normalizedKey] = patched.entry;
            for (const legacyKey of resolved.legacyKeys) {
                delete store[legacyKey];
            }
            return patched.entry;
        },
        { activeSessionKey: params.sessionKey },
    );
}

export async function canonicalizeWechatSessionStoreRouteForConfig(params: {
    api: OpenClawPluginApi;
    cfg: Record<string, unknown>;
    sessionKey?: string;
    reason?: string;
    force?: boolean;
}) {
    const sessionKey = params.sessionKey?.trim();
    if (!sessionKey) {
        return;
    }
    const sessionRoute = parseWechatDeliveryRouteFromSessionKey(sessionKey);
    if (!params.force && !sessionRoute && !sessionKey.toLowerCase().includes(":wechat:")) {
        return;
    }

    try {
        const storePath = params.api.runtime.channel.session.resolveStorePath(
            (params.cfg as any)?.session?.store,
            { agentId: "main" },
        );
        await canonicalizeWechatSessionStoreRoute({
            api: params.api,
            storePath,
            sessionKey,
        });
    } catch (err: any) {
        params.api.logger.warn?.(
            `[WeChat] Failed to canonicalize session route` +
            `${params.reason ? ` reason=${params.reason}` : ""}` +
            ` session=${sessionKey} err=${err?.message || err}`,
        );
    }
}

export async function recordWechatInboundSessionRoute(params: {
    api: OpenClawPluginApi;
    cfg: Record<string, unknown>;
    sessionKey: string;
    ctx: Record<string, unknown>;
    to: string;
    accountId: string;
    threadId: string;
}) {
    try {
        const storePath = params.api.runtime.channel.session.resolveStorePath(
            (params.cfg as any)?.session?.store,
            { agentId: "main" },
        );
        await params.api.runtime.channel.session.recordSessionMetaFromInbound({
            storePath,
            sessionKey: params.sessionKey,
            ctx: params.ctx as any,
            createIfMissing: true,
        });
        await params.api.runtime.channel.session.updateLastRoute({
            storePath,
            sessionKey: params.sessionKey,
            deliveryContext: {
                channel: "wechat",
                to: params.to,
                accountId: params.accountId,
                threadId: params.threadId,
            },
            ctx: params.ctx as any,
            createIfMissing: true,
        });
        await canonicalizeWechatSessionStoreRoute({
            api: params.api,
            storePath,
            sessionKey: params.sessionKey,
        });
    } catch (err: any) {
        params.api.logger.warn?.(
            `[WeChat] Failed to record canonical session route session=${params.sessionKey} err=${err?.message || err}`,
        );
    }
}

export async function refreshWechatDirectSessionDisplayName(params: {
    api: OpenClawPluginApi;
    cfg: Record<string, unknown>;
    sessionKey: string;
    ctx: Record<string, unknown>;
    displayName: string;
}) {
    const displayName = params.displayName.trim();
    if (
        !displayName ||
        displayName === "User" ||
        /^wxid_/i.test(displayName) ||
        displayName.endsWith("@chatroom")
    ) {
        return;
    }

    try {
        const storePath = params.api.runtime.channel.session.resolveStorePath(
            (params.cfg as any)?.session?.store,
            { agentId: "main" },
        );
        await params.api.runtime.channel.session.recordSessionMetaFromInbound({
            storePath,
            sessionKey: params.sessionKey,
            ctx: params.ctx as any,
            createIfMissing: true,
        });
        await updateSessionStore(
            storePath,
            (store) => {
                const resolved = resolveSessionStoreEntry({
                    store,
                    sessionKey: params.sessionKey,
                });
                const existing = resolved.existing;
                if (!existing) {
                    return null;
                }
                if (typeof existing.displayName === "string" && existing.displayName.trim() === displayName) {
                    return existing;
                }
                const next = {
                    ...existing,
                    displayName,
                };
                store[resolved.normalizedKey] = next;
                for (const legacyKey of resolved.legacyKeys) {
                    delete store[legacyKey];
                }
                return next;
            },
            { activeSessionKey: params.sessionKey },
        );
        params.api.logger.debug?.(
            `[WeChat] Refreshed direct session displayName session=${params.sessionKey} displayName="${summarizeWechatTextForLog(displayName, 80)}"`,
        );
    } catch (err: any) {
        params.api.logger.warn?.(
            `[WeChat] Failed to refresh direct session displayName session=${params.sessionKey} err=${err?.message || err}`,
        );
    }
}
