import type { ChannelPlugin } from "openclaw/plugin-sdk";
import { getWechatRuntime, isBridgeConnected, sendToBridge } from "./runtime.js";
import { isPathWithinRoots, resolveWechatExtensionConfig, resolveWechatMediaServeRoots } from "./config.js";
import { redactWechatWxids } from "./redaction.js";

const CACHE_TTL = 60000;
const contactNameCache: Map<string, { id: string; name: string; type: string; timestamp: number }> = new Map();
const WECHAT_CHANNEL_MODE = "bridge-ws";

function buildOutboundFrame(event: "outbound_text" | "outbound_media", payload: Record<string, unknown>) {
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
    outbound: {
        deliveryMode: "direct",
        sendText: async ({ to, text, accountId }) => {
            const runtime = getWechatRuntime();
            const cfg = runtime?.config.loadConfig?.() || {};
            const bridgeConfig = resolveWechatExtensionConfig(cfg, (runtime as any)?.logger ?? console);
            const safeText = redactWechatOutboundText(text, bridgeConfig);
            runtime?.logger?.info?.(
                `[WeChat Outbound] to=${to} account=${accountId || "default"} type=text text="${summarizeWechatOutboundTextForLog(safeText, bridgeConfig)}"`,
            );
            const payload = {
                type: "text",
                to,
                text: safeText,
                accountId,
            };
            const sent = sendToBridge(buildOutboundFrame("outbound_text", payload));
            if (!sent.ok) {
                console.error(`[WeChat] sendText failed: ${sent.error}`);
                return { ok: false, error: new Error(sent.error), channel: "wechat", messageId: "" };
            }
            return { ok: true, channel: "wechat", messageId: `msg-${Date.now()}` };
        },
        sendMedia: async ({ to, mediaUrl, text, accountId }) => {
            const runtime = getWechatRuntime();
            const cfg = runtime.config.loadConfig();
            const bridgeConfig = resolveWechatExtensionConfig(cfg, (runtime as any).logger ?? console);
            const safeText = typeof text === "string" ? redactWechatOutboundText(text, bridgeConfig) : text;
            runtime?.logger?.info?.(
                `[WeChat Outbound] to=${to} account=${accountId || "default"} type=media media="${mediaUrl}"` +
                `${safeText ? ` text="${summarizeWechatOutboundTextForLog(safeText, bridgeConfig)}"` : ""}`,
            );
            const serveRoots = resolveWechatMediaServeRoots(cfg, (runtime as any).logger ?? console);

            // 局域网部署：如果是本地路径，转成 HTTP URL 让 aiBot 通过 HTTP 下载
            // 避免 Base64 编码导致 WebSocket 消息体膨胀
            let resolvedUrl = mediaUrl;
            if (mediaUrl && !mediaUrl.startsWith("http://") && !mediaUrl.startsWith("https://")) {
                // 本地路径 → 转成 HTTP URL
                const host = bridgeConfig.bridgeDownloadHost;

                let absolutePath = mediaUrl;
                // 如果是相对路径，尝试在多个候选目录下查找
                if (!/^(?:[a-zA-Z]:[\\/]|\/)/.test(mediaUrl)) {
                    const os = await import("os");
                    const path = await import("path");
                    const fs = await import("fs");
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

                const path = await import("path");
                const fs = await import("fs");
                absolutePath = path.resolve(absolutePath);

                if (!fs.existsSync(absolutePath)) {
                    runtime?.logger?.warn?.(
                        `[WeChat] Local media path missing before bridge conversion: raw="${mediaUrl}" resolved="${absolutePath}"`,
                    );
                    return;
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
                
                // 核心发现：微信插件自带了一个运行在 wsPort（默认 9093）上的小型 HTTP 服务器
                // 用于专门给 AiBot 提供下载。不能使用 Gateway 的 18789 端口，那是给仪表盘用的。
                const bridgePort = bridgeConfig.wsPort;
                const downloadBaseUrl = bridgeConfig.bridgeDownloadBaseUrl || `http://${host}:${bridgePort}`;
                
                // 使用 encodeURIComponent 对路径分段进行转义，处理中文字符
                const encodedPath = absolutePath.split(/[\\\/]/).map(segment => encodeURIComponent(segment)).join('/');
                
                // 构造指向微信插件自身 Bridge 服务的下载链接
                // 注意：这里必须用绝对路径，因为 Bridge 的 /media/ 实现是直接拼 / 后缀的
                resolvedUrl = `${downloadBaseUrl}/media/${encodedPath.startsWith('/') ? encodedPath.slice(1) : encodedPath}`;
                
                console.log(`[WeChat] 转换媒体路径(Bridge): ${absolutePath} -> ${resolvedUrl}`);
            }

            const payload: any = {
                type: "media",
                to,
                mediaUrl: resolvedUrl,
                text: safeText,
                accountId,
            };

            const sent = sendToBridge(buildOutboundFrame("outbound_media", payload));
            if (!sent.ok) {
                console.error(`[WeChat] sendMedia failed: ${sent.error}`);
                return { ok: false, error: new Error(sent.error), channel: "wechat", messageId: "" };
            }
            console.log(`[WeChat] sendMedia success: msg-${Date.now()}`);
            return { ok: true, channel: "wechat", messageId: `msg-${Date.now()}` };
        },
    },
};
