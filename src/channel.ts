import type { ChannelPlugin } from "openclaw/plugin-sdk";
import {
    buildChannelOutboundSessionRoute,
    type ChannelOutboundSessionRouteParams,
} from "openclaw/plugin-sdk/channel-core";
import {
    getWechatRuntime,
    isBridgeConnected,
    resolveWechatRecentDirectChatKeyForSender,
} from "./runtime.js";
import { resolveWechatExtensionConfig } from "./config.js";
import {
    inferWechatRouteTargetChatType,
    looksLikeWechatTargetId,
    normalizeWechatMessagingTarget,
    parseWechatExplicitTarget,
    stripWechatRouteTargetPrefixes,
    WECHAT_MESSAGING_TARGET_PREFIXES,
} from "./channel-targets.js";
import {
    sendWechatOutboundMedia,
    sendWechatOutboundText,
    summarizeWechatOutboundTextForLog,
} from "./outbound-send.js";
import { wechatChannelConfigSchema } from "./channel-config-schema.js";
import { handleWechatReactionAction } from "./channel-reactions.js";

const WECHAT_CHANNEL_MODE = "bridge-ws";

function resolveWechatOutboundDirectSessionPeerId(targetIdRaw: string): {
    peerId: string;
    canonicalized: boolean;
    canonicalSource?: "recent-sender";
} {
    const targetId = targetIdRaw.trim().toLowerCase();
    if (!targetId.startsWith("wxid_")) {
        return {
            peerId: targetId,
            canonicalized: false,
        };
    }

    const recentChatKey = resolveWechatRecentDirectChatKeyForSender(targetId);
    if (recentChatKey && !recentChatKey.startsWith("wxid_")) {
        return {
            peerId: recentChatKey,
            canonicalized: recentChatKey !== targetId,
            canonicalSource: "recent-sender",
        };
    }

    return {
        peerId: targetId,
        canonicalized: false,
    };
}

function resolveWechatOutboundSessionRoute(params: ChannelOutboundSessionRouteParams) {
    const targetId = stripWechatRouteTargetPrefixes(params.resolvedTarget?.to || params.target);
    if (!targetId) {
        return null;
    }

    const resolvedKind = params.resolvedTarget?.kind;
    const isGroup =
        resolvedKind === "group" ||
        resolvedKind === "channel" ||
        targetId.toLowerCase().endsWith("@chatroom");
    const directPeer = isGroup
        ? undefined
        : resolveWechatOutboundDirectSessionPeerId(targetId);
    const peerId = isGroup ? targetId.trim().toLowerCase() : directPeer!.peerId;
    if (!peerId) {
        return null;
    }

    if (directPeer?.canonicalized) {
        const runtime = getWechatRuntime();
        const bridgeConfig = resolveWechatExtensionConfig(params.cfg, (runtime as any)?.logger ?? console);
        runtime?.logger?.info?.(
            `[WeChat] Canonicalized outbound direct session target=${summarizeWechatOutboundTextForLog(targetId, bridgeConfig)}` +
            ` peer=${peerId} source=${directPeer.canonicalSource || "unknown"}` +
            ` currentSession=${summarizeWechatOutboundTextForLog(params.currentSessionKey, bridgeConfig)}`,
        );
    }

    return buildChannelOutboundSessionRoute({
        cfg: params.cfg,
        agentId: params.agentId,
        channel: "wechat",
        accountId: params.accountId,
        peer: {
            kind: isGroup ? "group" : "direct",
            id: peerId,
        },
        chatType: isGroup ? "group" : "direct",
        from: isGroup ? `wechat:group:${peerId}` : `wechat:${peerId}`,
        to: isGroup ? `channel:${peerId}` : `user:${peerId}`,
    });
}

export const wechatPlugin: ChannelPlugin<any> = {
    id: "wechat",
    meta: {
        id: "wechat",
        label: "WeChat",
        aliases: ["openclaw-weixin", "weixin"],
        selectionLabel: "WeChat (Bridge WS)",
        docsPath: "/docs/channels/wechat",
        blurb: "Connect to WeChat via Python Bridge over WebSocket",
        showConfigured: true,
    },
    capabilities: {
        chatTypes: ["direct", "group"],
        media: true,
        reactions: true,
    },
    config: {
        listAccountIds: (cfg) => {
            const accounts = cfg.channels?.wechat?.accounts;
            return accounts ? Object.keys(accounts) : ["default"];
        },
        resolveAccount: (cfg, accountId) => {
            const acc = cfg.channels?.wechat?.accounts?.[accountId || "default"] || {};
            return {
                accountId: accountId || "default",
                name: acc.name || "WeChat",
                enabled: acc.enabled !== false,
                config: acc,
            };
        },
        isConfigured: () => true,
    },
    configSchema: wechatChannelConfigSchema,
    gateway: {
        startAccount: async (ctx) => {
            if (isBridgeConnected()) {
                ctx.log?.info(`WeChat channel ${ctx.accountId} 已启动，桥接已连接。`);
            } else {
                ctx.log?.info(`WeChat channel ${ctx.accountId} 已启动，等待桥接连接。`);
            }
            while (!ctx.abortSignal.aborted) {
                await new Promise((r) => setTimeout(r, 1000));
            }
            return { ok: true };
        },
    },
    status: {
        buildChannelSummary: ({ snapshot }) => {
            return {
                configured: snapshot.configured ?? true,
                running: snapshot.running ?? true,
                connected: isBridgeConnected(),
                mode: snapshot.mode ?? WECHAT_CHANNEL_MODE,
                lastStartAt: snapshot.lastStartAt ?? null,
                lastStopAt: snapshot.lastStopAt ?? null,
                lastInboundAt: snapshot.lastInboundAt ?? null,
                lastOutboundAt: snapshot.lastOutboundAt ?? null,
                lastProbeAt: snapshot.lastProbeAt ?? null,
                lastError: snapshot.lastError ?? null,
                probe: snapshot.probe ?? null,
            };
        },
        buildAccountSnapshot: ({ account, runtime }) => {
            return {
                ...runtime,
                accountId: account.accountId,
                name: account.name,
                enabled: account.enabled,
                configured: true,
                running: true,
                connected: isBridgeConnected(),
                mode: WECHAT_CHANNEL_MODE,
            };
        },
    },
    messaging: {
        targetPrefixes: WECHAT_MESSAGING_TARGET_PREFIXES,
        normalizeTarget: normalizeWechatMessagingTarget,
        parseExplicitTarget: ({ raw }) => parseWechatExplicitTarget(raw),
        inferTargetChatType: ({ to }) => parseWechatExplicitTarget(to)?.chatType,
        resolveOutboundSessionRoute: resolveWechatOutboundSessionRoute,
        targetResolver: {
            hint: "可使用 wxid_xxx、xxx@chatroom，或直接输入群名/备注",
            looksLikeId: looksLikeWechatTargetId,
            resolveTarget: async ({ input, normalized }) => {
                const id = stripWechatRouteTargetPrefixes(normalized || input);
                const explicitChatType = inferWechatRouteTargetChatType(input);
                const isGroup = explicitChatType === "group" || id.endsWith("@chatroom");
                return {
                    to: id,
                    kind: isGroup ? "group" : "user",
                };
            },
        },
    },
    actions: {
        describeMessageTool: () => ({
            actions: ["send", "react"],
            capabilities: [],
        }),
        supportsAction: ({ action }) => action === "react",
        handleAction: handleWechatReactionAction,
    },
    outbound: {
        deliveryMode: "direct",
        extractMarkdownImages: true,
        sendText: sendWechatOutboundText,
        sendMedia: sendWechatOutboundMedia,
    },
};
