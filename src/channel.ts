import type { ChannelPlugin } from "openclaw/plugin-sdk";
import { getWechatRuntime, isBridgeConnected, sendToBridge } from "./runtime.js";
import { isPathWithinRoots, resolveWechatExtensionConfig, resolveWechatMediaServeRoots } from "./config.js";

const CACHE_TTL = 60000;
const contactNameCache: Map<string, { id: string; name: string; type: string; timestamp: number }> = new Map();

function buildOutboundFrame(event: "outbound_text" | "outbound_media", payload: Record<string, unknown>) {
    return {
        direction: "openclaw_to_bridge",
        event,
        payload,
        ts: Date.now(),
    };
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
        buildAccountSnapshot: ({ account, runtime }) => {
            return {
                ...runtime,
                accountId: account.accountId,
                name: account.name,
                enabled: account.enabled,
                configured: true,
                running: true,
                connected: isBridgeConnected(),
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
            const payload = {
                type: "text",
                to,
                text,
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
                text,
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
