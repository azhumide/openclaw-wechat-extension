import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import type { ChannelPlugin } from "openclaw/plugin-sdk";
import {
    jsonResult,
    readReactionParams,
    readStringParam,
    resolveReactionMessageId,
} from "openclaw/plugin-sdk/channel-actions";
import { getWechatRuntime, isBridgeConnected, sendToBridge } from "./runtime.js";
import { isPathWithinRoots, resolveWechatExtensionConfig, resolveWechatMediaServeRoots } from "./config.js";
import { redactWechatWxids } from "./redaction.js";

const CACHE_TTL = 60000;
const contactNameCache: Map<string, { id: string; name: string; type: string; timestamp: number }> = new Map();
const WECHAT_CHANNEL_MODE = "bridge-ws";
const WECHAT_REACTION_FALLBACK_MODE = "emoji-message-fallback";
const WECHAT_OUTBOUND_MEDIA_DEDUP_TTL_MS = 10_000;
const WECHAT_OUTBOUND_MEDIA_DEDUP_SAMPLE_BYTES = 128 * 1024;
const recentOutboundMediaAt = new Map<string, number>();

function buildOutboundFrame(
    event: "outbound_text" | "outbound_media" | "outbound_reaction",
    payload: Record<string, unknown>,
) {
    return {
        direction: "openclaw_to_bridge",
        event,
        payload,
        ts: Date.now(),
    };
}

function summarizeWechatTextForLog(text: unknown, maxLength = 160): string {
    if (typeof text !== "string") {
        return "";
    }
    const normalized = text.replace(/\r\n/g, "\n").replace(/\n/g, "\\n").trim();
    if (!normalized) {
        return "";
    }
    if (normalized.length <= maxLength) {
        return normalized;
    }
    return `${normalized.slice(0, maxLength)}...`;
}

function pruneWechatOutboundMediaDedupCache(now = Date.now()) {
    for (const [dedupKey, seenAt] of recentOutboundMediaAt) {
        if (now - seenAt > WECHAT_OUTBOUND_MEDIA_DEDUP_TTL_MS) {
            recentOutboundMediaAt.delete(dedupKey);
        }
    }
}

function claimWechatOutboundMediaDedup(dedupKey: string): boolean {
    const now = Date.now();
    pruneWechatOutboundMediaDedupCache(now);
    const seenAt = recentOutboundMediaAt.get(dedupKey);
    if (typeof seenAt === "number" && now - seenAt < WECHAT_OUTBOUND_MEDIA_DEDUP_TTL_MS) {
        return false;
    }
    recentOutboundMediaAt.set(dedupKey, now);
    return true;
}

function releaseWechatOutboundMediaDedup(dedupKey: string) {
    recentOutboundMediaAt.delete(dedupKey);
}

function buildWechatLocalMediaFingerprint(filePath: string): string {
    const absolutePath = path.resolve(filePath.trim());
    const stat = fs.statSync(absolutePath);
    const hash = createHash("sha1");
    hash.update(`size:${stat.size};`);

    const fd = fs.openSync(absolutePath, "r");
    try {
        const headBytes = Math.min(Number(stat.size), WECHAT_OUTBOUND_MEDIA_DEDUP_SAMPLE_BYTES);
        if (headBytes > 0) {
            const headBuffer = Buffer.alloc(headBytes);
            const headRead = fs.readSync(fd, headBuffer, 0, headBytes, 0);
            hash.update(headBuffer.subarray(0, headRead));

            if (stat.size > headBytes) {
                const tailBytes = Math.min(Number(stat.size) - headBytes, WECHAT_OUTBOUND_MEDIA_DEDUP_SAMPLE_BYTES);
                if (tailBytes > 0) {
                    const tailBuffer = Buffer.alloc(tailBytes);
                    const tailRead = fs.readSync(fd, tailBuffer, 0, tailBytes, Number(stat.size) - tailBytes);
                    hash.update(tailBuffer.subarray(0, tailRead));
                }
            }
        }
    } finally {
        fs.closeSync(fd);
    }

    return `local:${path.extname(absolutePath).toLowerCase()}:${hash.digest("hex")}`;
}

function buildWechatOutboundMediaDedupKey(params: {
    to: string;
    mediaUrl: string;
    accountId?: string;
}): string {
    const trimmedMedia = params.mediaUrl.trim();
    const mediaFingerprint =
        /^https?:\/\//i.test(trimmedMedia)
            ? `remote:${trimmedMedia}`
            : buildWechatLocalMediaFingerprint(trimmedMedia);

    return [
        `to:${params.to.trim()}`,
        `account:${(params.accountId || "default").trim() || "default"}`,
        mediaFingerprint,
    ].join("|");
}

function redactWechatOutboundText(text: string, options: {
    redactWxidsInOutboundText?: boolean;
    redactExtraWxids?: string[];
}): string {
    return redactWechatWxids(text, {
        enabled: options.redactWxidsInOutboundText !== false,
        exactMatches: options.redactExtraWxids,
    });
}

function summarizeWechatOutboundTextForLog(text: unknown, options: {
    redactWxidsInLogs?: boolean;
    redactExtraWxids?: string[];
}): string {
    return summarizeWechatTextForLog(
        typeof text === "string"
            ? redactWechatWxids(text, {
                enabled: options.redactWxidsInLogs !== false,
                exactMatches: options.redactExtraWxids,
            })
            : text,
    );
}

export const wechatPlugin: ChannelPlugin<any> = {
    id: "wechat",
    meta: {
        id: "wechat",
        label: "WeChat",
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
    configSchema: {
        schema: {
            type: "object",
            properties: {
                wsHost: { type: "string", description: "Bridge WS server host" },
                wsPort: { type: "number", description: "Bridge WS server port" },
                wsPath: { type: "string", description: "Bridge WS path" },
                bridgeDownloadHost: { type: "string", description: "Bridge HTTP download host/IP for remote media access" },
                bridgeDownloadBaseUrl: { type: "string", description: "Full public base URL for bridge downloads, e.g. https://example.com" },
                workspaceBase: { type: "string", description: "Workspace base path used for temp/download files" },
                tmpDir: { type: "string", description: "Override temp directory for inbound media files" },
                mediaSearchPaths: {
                    type: "array",
                    description: "Additional directories searched for relative media paths",
                    items: { type: "string" },
                },
                redactWxidsInOutboundText: {
                    type: "boolean",
                    description: "Mask wxid_* identifiers in outbound reply text before sending to the bridge",
                },
                redactWxidsInLogs: {
                    type: "boolean",
                    description: "Mask wxid_* identifiers in WeChat plugin logs",
                },
                redactExtraWxids: {
                    type: "array",
                    description: "Additional exact-match WeChat ids to redact, for example custom ids like xdoufux",
                    items: { type: "string" },
                },
                nonOwnerToolAuthMode: {
                    type: "string",
                    description: "How guarded tools behave for non-owner WeChat senders: off | deny | approve",
                },
                nonOwnerToolAuthTools: {
                    type: "array",
                    description: "Tool names guarded by WeChat owner auth, defaults to exec/process",
                    items: { type: "string" },
                },
                toolAuthBypassWxids: {
                    type: "array",
                    description: "Trusted WeChat sender ids that bypass guarded tool deny/approval checks; supports sender wxid and direct-chat alias",
                    items: { type: "string" },
                },
                toolAuthBypassByTool: {
                    type: "object",
                    description: "Per-tool trusted sender ids; keys are tool names like exec/process and values are arrays of wxids or direct-chat aliases",
                    additionalProperties: {
                        type: "array",
                        items: { type: "string" },
                    },
                },
                toolAuthAllowInstalledSkills: {
                    type: "boolean",
                    description: "Allow guarded exec/process calls that match installed skill command patterns, even for non-owner senders",
                },
                ownerExecBypassApproval: {
                    type: "boolean",
                    description: "Best-effort: force exec ask=off for owner WeChat senders before host exec policy runs",
                },
                toolAuthNotifyBlocked: {
                    type: "boolean",
                    description: "Whether to send a WeChat notice when a non-owner is directly blocked from guarded tools",
                },
                toolAuthNotifyApprovalQueued: {
                    type: "boolean",
                    description: "Whether to send a WeChat notice when guarded tool approval has been submitted",
                },
                toolAuthNotifyApprovalResolved: {
                    type: "boolean",
                    description: "Whether to send a WeChat notice when guarded tool approval resolves",
                },
                toolAuthNotifyInGroup: {
                    type: "boolean",
                    description: "Whether tool auth notices are allowed in group chats",
                },
                toolAuthNotifyInDirect: {
                    type: "boolean",
                    description: "Whether tool auth notices are allowed in direct chats",
                },
                toolAuthMessageBlocked: {
                    type: "string",
                    description: "Custom message template for direct block notices",
                },
                toolAuthMessageQueued: {
                    type: "string",
                    description: "Custom message template for approval queued notices",
                },
                toolAuthMessageAllowOnce: {
                    type: "string",
                    description: "Custom message template for allow-once approval notices",
                },
                toolAuthMessageAllowAlways: {
                    type: "string",
                    description: "Custom message template for allow-always approval notices",
                },
                toolAuthMessageDeny: {
                    type: "string",
                    description: "Custom message template for denied approval notices",
                },
                toolAuthMessageTimeout: {
                    type: "string",
                    description: "Custom message template for approval timeout notices",
                },
                toolAuthMessageCancelled: {
                    type: "string",
                    description: "Custom message template for cancelled approval notices",
                },
            },
        },
    },
    gateway: {
        startAccount: async (ctx) => {
            ctx.log?.info(`WeChat channel ${ctx.accountId} started. Waiting for WS bridge.`);
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
        targetResolver: {
            hint: "可使用 wxid_xxx、xxx@chatroom，或直接输入群名/备注",
            looksLikeId: (raw: string): boolean => {
                const trimmed = raw.trim();
                if (trimmed.endsWith("@chatroom")) return true;
                if (trimmed.startsWith("wxid_")) return true;
                if (trimmed.startsWith("wechat:")) return true;
                if (/^\d{5,}(@chatroom)?$/.test(trimmed)) return true;
                return false;
            },
            resolveTarget: async ({ input }) => {
                const trimmed = input.trim();
                const id = trimmed.replace(/^wechat:/i, "");
                const isGroup = id.endsWith("@chatroom");
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
        handleAction: async ({ action, params, accountId, toolContext }) => {
            if (action !== "react") {
                throw new Error(`Action ${action} is not supported for provider wechat.`);
            }

            const runtime = getWechatRuntime();
            const cfg = runtime?.config.current?.() || {};
            const bridgeConfig = resolveWechatExtensionConfig(cfg, (runtime as any)?.logger ?? console);
            const to = readStringParam(params, "to") ?? readStringParam(params, "target", { required: true });
            const { emoji, remove, isEmpty } = readReactionParams(params, {
                removeErrorMessage: "Emoji is required to remove a WeChat reaction.",
            });

            if (remove) {
                throw new Error("WeChat reaction removal is not supported by the current bridge.");
            }
            if (isEmpty) {
                throw new Error("WeChat react requires emoji parameter.");
            }

            const reactionMessageIdRaw = resolveReactionMessageId({
                args: params,
                toolContext: {
                    currentMessageId: toolContext?.currentMessageId ?? undefined,
                },
            });
            const reactionMessageId =
                reactionMessageIdRaw != null ? String(reactionMessageIdRaw).trim() || undefined : undefined;
            const safeEmoji = redactWechatOutboundText(emoji, bridgeConfig);

            runtime?.logger?.info?.(
                `[WeChat Action] action=react to=${to} account=${accountId || "default"}` +
                `${reactionMessageId ? ` messageId=${reactionMessageId}` : ""}` +
                ` emoji="${summarizeWechatOutboundTextForLog(safeEmoji, bridgeConfig)}"` +
                ` mode=${WECHAT_REACTION_FALLBACK_MODE}`,
            );

            const payload = {
                type: "reaction",
                to,
                emoji: safeEmoji,
                text: safeEmoji,
                accountId,
                ...(reactionMessageId ? { messageId: reactionMessageId } : {}),
                mode: WECHAT_REACTION_FALLBACK_MODE,
            };

            const sent = sendToBridge(buildOutboundFrame("outbound_reaction", payload));
            if (!sent.ok) {
                throw new Error(sent.error);
            }

            return jsonResult({
                ok: true,
                added: emoji,
                to,
                ...(reactionMessageId ? { messageId: reactionMessageId } : {}),
                mode: WECHAT_REACTION_FALLBACK_MODE,
            });
        },
    },
    outbound: {
        deliveryMode: "direct",
        sendText: async ({ to, text, accountId, msg_id, original_msg_id, messageId, replyToId }: any) => {
            const runtime = getWechatRuntime();
            const cfg = runtime?.config.current?.() || {};
            const bridgeConfig = resolveWechatExtensionConfig(cfg, (runtime as any)?.logger ?? console);
            const safeText = redactWechatOutboundText(text, bridgeConfig);
            const callbackMsgId =
                typeof original_msg_id === "string" && original_msg_id.trim()
                    ? original_msg_id.trim()
                    : (typeof msg_id === "string" && msg_id.trim() ? msg_id.trim() : "");
            runtime?.logger?.info?.(
                `[WeChat Outbound] to=${to} account=${accountId || "default"} type=text text="${summarizeWechatOutboundTextForLog(safeText, bridgeConfig)}"`,
            );
            const payload = {
                type: "text",
                to,
                text: safeText,
                accountId,
                ...(callbackMsgId ? { msg_id: callbackMsgId } : {}),
                ...(typeof original_msg_id === "string" && original_msg_id.trim()
                    ? { original_msg_id: original_msg_id.trim() }
                    : {}),
                ...(typeof messageId === "string" && messageId.trim() ? { messageId: messageId.trim() } : {}),
                ...(typeof replyToId === "string" && replyToId.trim() ? { replyToId: replyToId.trim() } : {}),
            };
            const sent = sendToBridge(buildOutboundFrame("outbound_text", payload));
            if (!sent.ok) {
                console.error(`[WeChat] sendText failed: ${sent.error}`);
                return { ok: false, error: new Error(sent.error), channel: "wechat", messageId: "" };
            }
            return { ok: true, channel: "wechat", messageId: `msg-${Date.now()}` };
        },
        sendMedia: async ({ to, mediaUrl, text, accountId, msg_id, original_msg_id, messageId, replyToId }: any) => {
            const runtime = getWechatRuntime();
            const cfg = runtime.config.current();
            const bridgeConfig = resolveWechatExtensionConfig(cfg, (runtime as any).logger ?? console);
            const safeText = typeof text === "string" ? redactWechatOutboundText(text, bridgeConfig) : text;
            const callbackMsgId =
                typeof original_msg_id === "string" && original_msg_id.trim()
                    ? original_msg_id.trim()
                    : (typeof msg_id === "string" && msg_id.trim() ? msg_id.trim() : "");
            const traceId =
                [original_msg_id, msg_id, messageId, replyToId]
                    .map((value) => typeof value === "string" ? value.trim() : "")
                    .find(Boolean) || "";
            runtime?.logger?.info?.(
                `[WeChat Outbound] to=${to} account=${accountId || "default"} type=media media="${mediaUrl}"` +
                `${safeText ? ` text="${summarizeWechatOutboundTextForLog(safeText, bridgeConfig)}"` : ""}`,
            );
            let outboundMediaDedupKey = "";
            try {
                const serveRoots = resolveWechatMediaServeRoots(cfg, (runtime as any).logger ?? console);

                // 优先解析本地路径；必要时先暂存到受控目录，再把绝对路径直接交给 Bridge。
                // 这样可以避免不必要的 HTTP 中转和 WebSocket 体积膨胀。
                let resolvedUrl = mediaUrl;
                if (mediaUrl && !mediaUrl.startsWith("http://") && !mediaUrl.startsWith("https://")) {
                    let absolutePath = mediaUrl;
                    // 如果是相对路径，尝试在多个候选目录下查找
                    if (!/^(?:[a-zA-Z]:[\\/]|\/)/.test(mediaUrl)) {
                        const os = await import("os");
                        const workspaceDir = bridgeConfig.workspaceBase || path.join(os.homedir(), ".openclaw", "workspace");
                        const candidates = [
                            path.join(workspaceDir, mediaUrl),
                            path.join(workspaceDir, "downloads", mediaUrl),
                            ...bridgeConfig.mediaSearchPaths.map((baseDir) => path.join(baseDir, mediaUrl)),
                        ];
                        for (const candidate of candidates) {
                            if (fs.existsSync(candidate)) {
                                absolutePath = candidate;
                                break;
                            }
                        }
                    }

                    absolutePath = path.resolve(absolutePath);

                    if (!fs.existsSync(absolutePath)) {
                        const errorMessage = `Local media path missing before bridge conversion: raw="${mediaUrl}" resolved="${absolutePath}"`;
                        runtime?.logger?.warn?.(
                            `[WeChat] ${errorMessage}`,
                        );
                        return {
                            ok: false,
                            error: new Error(errorMessage),
                            channel: "wechat",
                            messageId: "",
                        };
                    }

                    outboundMediaDedupKey = buildWechatOutboundMediaDedupKey({
                        to,
                        accountId,
                        mediaUrl: absolutePath,
                    });
                    if (!claimWechatOutboundMediaDedup(outboundMediaDedupKey)) {
                        runtime?.logger?.info?.(
                            `[WeChat] Skip duplicate outbound media within ${WECHAT_OUTBOUND_MEDIA_DEDUP_TTL_MS}ms ` +
                            `to=${to} account=${accountId || "default"} trace=${traceId} media="${summarizeWechatTextForLog(absolutePath, 180)}"`,
                        );
                        return { ok: true, channel: "wechat", messageId: `msg-${Date.now()}` };
                    }

                    if (fs.existsSync(absolutePath) && !isPathWithinRoots(absolutePath, serveRoots)) {
                        const stageBase = bridgeConfig.tmpDir
                            ? path.resolve(bridgeConfig.tmpDir)
                            : path.join(bridgeConfig.workspaceBase, "downloads");
                        const stageDir = path.join(stageBase, "wechat-bridge-media");
                        fs.mkdirSync(stageDir, { recursive: true });
                        const stagedName = `${Date.now()}_${path.basename(absolutePath)}`;
                        const stagedPath = path.join(stageDir, stagedName);
                        fs.copyFileSync(absolutePath, stagedPath);
                        absolutePath = stagedPath;
                    }
                    
                    // 局域网同机部署：直接发送绝对路径，由 Bridge 自主决定是直接读取还是下载。
                    // 这样可以避开不必要的 HTTP 转发和编码消耗。
                    resolvedUrl = absolutePath;
                    
                    console.log(`[WeChat] 媒体路径识别(Local-Direct): ${absolutePath}`);
                } else if (mediaUrl) {
                    outboundMediaDedupKey = buildWechatOutboundMediaDedupKey({
                        to,
                        accountId,
                        mediaUrl,
                    });
                    if (!claimWechatOutboundMediaDedup(outboundMediaDedupKey)) {
                        runtime?.logger?.info?.(
                            `[WeChat] Skip duplicate outbound media within ${WECHAT_OUTBOUND_MEDIA_DEDUP_TTL_MS}ms ` +
                            `to=${to} account=${accountId || "default"} trace=${traceId} media="${summarizeWechatTextForLog(mediaUrl, 180)}"`,
                        );
                        return { ok: true, channel: "wechat", messageId: `msg-${Date.now()}` };
                    }
                }

                const payload: any = {
                    type: "media",
                    to,
                    mediaUrl: resolvedUrl,
                    text: safeText,
                    accountId,
                    ...(callbackMsgId ? { msg_id: callbackMsgId } : {}),
                    ...(typeof original_msg_id === "string" && original_msg_id.trim()
                        ? { original_msg_id: original_msg_id.trim() }
                        : {}),
                    ...(typeof messageId === "string" && messageId.trim() ? { messageId: messageId.trim() } : {}),
                    ...(typeof replyToId === "string" && replyToId.trim() ? { replyToId: replyToId.trim() } : {}),
                };

                const sent = sendToBridge(buildOutboundFrame("outbound_media", payload));
                if (!sent.ok) {
                    if (outboundMediaDedupKey) {
                        releaseWechatOutboundMediaDedup(outboundMediaDedupKey);
                    }
                    console.error(`[WeChat] sendMedia failed: ${sent.error}`);
                    return { ok: false, error: new Error(sent.error), channel: "wechat", messageId: "" };
                }
                console.log(`[WeChat] sendMedia success: msg-${Date.now()}`);
                return { ok: true, channel: "wechat", messageId: `msg-${Date.now()}` };
            } catch (error) {
                if (outboundMediaDedupKey) {
                    releaseWechatOutboundMediaDedup(outboundMediaDedupKey);
                }
                throw error;
            }
        },
    },
};
