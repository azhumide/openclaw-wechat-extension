import type { ChannelPlugin } from "openclaw/plugin-sdk";
import {
    buildChannelOutboundSessionRoute,
    type ChannelOutboundSessionRouteParams,
} from "openclaw/plugin-sdk/channel-core";
import {
    createMessageReceiptFromOutboundResults,
    defineChannelMessageAdapter,
    type ChannelMessageSendResult,
    type MessageReceiptPartKind,
} from "openclaw/plugin-sdk/channel-message";
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
export const WECHAT_LEGACY_ALIAS_PLUGIN_MARKER = "__wechatLegacyAliasPlugin";

function createWechatSendReceipt(params: {
    messageId?: string;
    target: string;
    kind: MessageReceiptPartKind;
    replyToId?: string | null;
}) {
    const messageId = params.messageId?.trim();
    return createMessageReceiptFromOutboundResults({
        results: messageId
            ? [
                {
                    channel: "wechat",
                    messageId,
                    conversationId: params.target,
                },
            ]
            : [],
        threadId: params.target,
        replyToId: params.replyToId ?? undefined,
        kind: params.kind,
    });
}

function assertWechatOutboundSent(
    result: Awaited<ReturnType<typeof sendWechatOutboundText | typeof sendWechatOutboundMedia>>,
    action: "text" | "media",
) {
    if (result?.ok !== false) {
        return;
    }
    const error = result.error;
    if (error instanceof Error) {
        throw error;
    }
    throw new Error(`WeChat ${action} send failed`);
}

function toWechatMessageSendResult(params: {
    result: Awaited<ReturnType<typeof sendWechatOutboundText | typeof sendWechatOutboundMedia>>;
    target: string;
    kind: MessageReceiptPartKind;
    replyToId?: string | null;
}): ChannelMessageSendResult {
    const messageId =
        typeof params.result?.messageId === "string" ? params.result.messageId.trim() : "";
    return {
        ...(messageId ? { messageId } : {}),
        receipt: createWechatSendReceipt({
            messageId,
            target: params.target,
            kind: params.kind,
            replyToId: params.replyToId,
        }),
    };
}

const wechatMessageAdapter = defineChannelMessageAdapter({
    id: "wechat",
    durableFinal: {
        capabilities: {
            text: true,
            media: true,
            replyTo: true,
        },
    },
    send: {
        text: async (ctx) => {
            const result = await sendWechatOutboundText({
                to: ctx.to,
                text: ctx.text,
                accountId: ctx.accountId,
                replyToId: ctx.replyToId,
            });
            assertWechatOutboundSent(result, "text");
            return toWechatMessageSendResult({
                result,
                target: ctx.to,
                kind: "text",
                replyToId: ctx.replyToId,
            });
        },
        media: async (ctx) => {
            const result = await sendWechatOutboundMedia({
                to: ctx.to,
                text: ctx.text,
                mediaUrl: ctx.mediaUrl,
                accountId: ctx.accountId,
                replyToId: ctx.replyToId,
                audioAsVoice: ctx.audioAsVoice,
            });
            assertWechatOutboundSent(result, "media");
            return toWechatMessageSendResult({
                result,
                target: ctx.to,
                kind: ctx.audioAsVoice ? "voice" : "media",
                replyToId: ctx.replyToId,
            });
        },
    },
});

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
    message: wechatMessageAdapter,
    agentPrompt: {
        messageToolHints: () => [
            "- WeChat send accepts generated media via `media`, `filePath`, or `attachments:[{filePath:\"/absolute/path\"}]`; prefer those fields over plain `MEDIA:` text.",
            "- In message-tool-only turns, do not finish with a `MEDIA:`/`FILE:` marker. Call `message(action=\"send\", message=\"...\", filePath=\"...\")`, then end with only `NO_REPLY`.",
            "- Prefer channel id `wechat` for explicit WeChat sends; legacy `openclaw-weixin` and `weixin` are aliases only.",
        ],
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

export function createWechatLegacyAliasPlugin(id: "openclaw-weixin" | "weixin"): ChannelPlugin<any> {
    return {
        ...wechatPlugin,
        id,
        meta: {
            ...wechatPlugin.meta,
            id,
            label: `WeChat (${id} alias)`,
            selectionLabel: "WeChat (legacy alias)",
            aliases: [],
            blurb: "Compatibility channel alias that routes through the WeChat plugin.",
            showConfigured: false,
            showInSetup: false,
            exposure: {
                configured: false,
                setup: false,
                docs: false,
            },
        },
        gateway: undefined,
        status: undefined,
        [WECHAT_LEGACY_ALIAS_PLUGIN_MARKER]: true,
    } as ChannelPlugin<any> & Record<string, unknown>;
}
