import * as fs from "fs";
import * as path from "path";
import { Buffer } from "buffer";
import { createServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { WebSocketServer, type WebSocket } from "ws";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk/core";
import { wechatPlugin } from "./src/channel.js";
import { isPathWithinRoots, resolveWechatExtensionConfig, resolveWechatMediaServeRoots } from "./src/config.js";
import {
    clearBridgeRuntimeState,
    getActiveBridgeSocket,
    getBridgeLastPongAt,
    markBridgePong,
    setActiveBridgeSocket,
    setWechatRuntime,
    setWechatWsServer,
} from "./src/runtime.js";

// 这里的全局变量仅用于当前模块实例引用
let bridgeHttpServer: HttpServer | null = null;
let bridgeWss: WebSocketServer | null = null;
let bridgeHeartbeatTimer: NodeJS.Timeout | null = null;
let bridgeClosePromise: Promise<void> | null = null;
const bridgeTcpSockets = new Set<Socket>();

const globalSym = Symbol.for("openclaw.wechat.bridge.state");

type WechatBridgeGlobalState = {
    runtime: OpenClawPluginApi["runtime"] | null;
    wsServer: WebSocketServer | null;
    activeSocket: WebSocket | null;
    lastPongAt: number;
    httpServer: HttpServer | null;
    heartbeatTimer: NodeJS.Timeout | null;
    closing: boolean;
};

function getGlobalState(): WechatBridgeGlobalState {
    if (!(globalThis as Record<symbol, unknown>)[globalSym]) {
        (globalThis as Record<symbol, unknown>)[globalSym] = {
            runtime: null,
            wsServer: null,
            activeSocket: null,
            lastPongAt: 0,
            httpServer: null,
            heartbeatTimer: null,
            closing: false,
        } satisfies WechatBridgeGlobalState;
    }
    return (globalThis as Record<symbol, WechatBridgeGlobalState>)[globalSym];
}

function syncModuleRefsFromState(state = getGlobalState()) {
    bridgeHttpServer = state.httpServer;
    bridgeWss = state.wsServer;
    bridgeHeartbeatTimer = state.heartbeatTimer;
}

function syncStateFromModuleRefs(state = getGlobalState()) {
    state.httpServer = bridgeHttpServer;
    state.wsServer = bridgeWss;
    state.heartbeatTimer = bridgeHeartbeatTimer;
}

function clearModuleRefs() {
    bridgeHttpServer = null;
    bridgeWss = null;
    bridgeHeartbeatTimer = null;
}

function clearBridgeStateRefs(state = getGlobalState()) {
    clearModuleRefs();
    state.httpServer = null;
    state.wsServer = null;
    state.heartbeatTimer = null;
}

function formatBridgeStateSnapshot(state = getGlobalState()) {
    const activeSocket = getActiveBridgeSocket();
    return [
        `closing=${state.closing}`,
        `hasHttp=${Boolean(state.httpServer)}`,
        `httpListening=${Boolean(state.httpServer?.listening)}`,
        `hasWs=${Boolean(state.wsServer)}`,
        `wsClients=${state.wsServer?.clients?.size ?? 0}`,
        `hasHeartbeat=${Boolean(state.heartbeatTimer)}`,
        `hasActiveSocket=${Boolean(activeSocket)}`,
        `activeSocketState=${activeSocket?.readyState ?? "none"}`,
        `tcpSockets=${bridgeTcpSockets.size}`,
        `hasClosePromise=${Boolean(bridgeClosePromise)}`,
    ].join(", ");
}

function logBridgeState(api: OpenClawPluginApi | undefined, phase: string, state = getGlobalState()) {
    api?.logger.debug?.(`[WeChat] Bridge state (${phase}): ${formatBridgeStateSnapshot(state)}`);
}

function buildFrame(direction: "openclaw_to_bridge", event: "ping" | "pong", payload: Record<string, unknown> = {}) {
    return {
        direction,
        event,
        payload,
        ts: Date.now(),
    };
}

function restoreServedFilePath(rawPath: string): string {
    const decoded = decodeURIComponent(rawPath);
    if (path.isAbsolute(decoded) || /^[a-zA-Z]:[\\/]/.test(decoded)) {
        return path.normalize(decoded);
    }
    return path.normalize(`/${decoded}`);
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function closeWebSocketServer(server: WebSocketServer): Promise<void> {
    return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            resolve();
        };

        try {
            for (const client of server.clients) {
                try {
                    client.terminate();
                } catch { }
            }
            server.close(() => finish());
        } catch {
            finish();
            return;
        }

        const timeout = setTimeout(finish, 1500);
        timeout.unref?.();
    });
}

function closeHttpServer(server: HttpServer): Promise<void> {
    return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            resolve();
        };

        try {
            server.closeIdleConnections?.();
        } catch { }
        try {
            server.closeAllConnections?.();
        } catch { }

        for (const socket of bridgeTcpSockets) {
            try {
                socket.destroy();
            } catch { }
        }
        bridgeTcpSockets.clear();

        try {
            if (!server.listening) {
                finish();
                return;
            }
            server.close(() => finish());
        } catch {
            finish();
            return;
        }

        const timeout = setTimeout(() => {
            try {
                server.closeAllConnections?.();
            } catch { }
            finish();
        }, 1500);
        timeout.unref?.();
    });
}

async function closeBridgeResources(api?: OpenClawPluginApi, reason = "shutdown") {
    if (bridgeClosePromise) {
        return bridgeClosePromise;
    }

    const state = getGlobalState();
    syncModuleRefsFromState(state);
    state.closing = true;
    logBridgeState(api, `close:start:${reason}`, state);

    bridgeClosePromise = (async () => {
        if (bridgeHeartbeatTimer) {
            clearInterval(bridgeHeartbeatTimer);
            bridgeHeartbeatTimer = null;
            state.heartbeatTimer = null;
        }

        const activeSocket = getActiveBridgeSocket();
        if (activeSocket) {
            try {
                activeSocket.terminate();
            } catch { }
            setActiveBridgeSocket(null);
        }

        const wsServer = bridgeWss ?? state.wsServer ?? null;
        bridgeWss = null;
        state.wsServer = null;
        setWechatWsServer(null);
        if (wsServer) {
            await closeWebSocketServer(wsServer);
        }

        const httpServer = bridgeHttpServer ?? state.httpServer ?? null;
        bridgeHttpServer = null;
        state.httpServer = null;
        if (httpServer) {
            await closeHttpServer(httpServer);
        } else {
            bridgeTcpSockets.clear();
        }

        clearModuleRefs();
        clearBridgeRuntimeState();
        logBridgeState(api, `close:done:${reason}`, state);
        api?.logger.debug?.(`[WeChat] Bridge resources closed (${reason})`);
    })().finally(() => {
        state.closing = false;
        bridgeClosePromise = null;
    });

    return bridgeClosePromise;
}

function handleBridgeHttpRequest(api: OpenClawPluginApi, req: IncomingMessage, res: ServerResponse) {
    if (req.url && req.url.startsWith("/media/")) {
        const filePath = restoreServedFilePath(req.url.slice("/media/".length));
        try {
            const allowedRoots = resolveWechatMediaServeRoots(api.runtime.config.loadConfig(), api.logger);
            if (!isPathWithinRoots(filePath, allowedRoots)) {
                res.statusCode = 403;
                res.end("Forbidden");
                return;
            }
            if (!fs.existsSync(filePath)) {
                res.statusCode = 404;
                res.end("File not found");
                return;
            }
            const stat = fs.statSync(filePath);
            if (!stat.isFile()) {
                res.statusCode = 400;
                res.end("Not a file");
                return;
            }
            const ext = path.extname(filePath).toLowerCase();
            const mimeMap: Record<string, string> = {
                ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp",
                ".mp4": "video/mp4", ".mov": "video/quicktime", ".avi": "video/x-msvideo",
                ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
                ".pdf": "application/pdf", ".bin": "application/octet-stream",
            };
            res.setHeader("Content-Type", mimeMap[ext] || "application/octet-stream");
            res.setHeader("Content-Length", stat.size);
            fs.createReadStream(filePath).pipe(res);
        } catch (err: any) {
            res.statusCode = 500;
            res.end(`Error: ${err.message}`);
        }
        return;
    }

    res.statusCode = 404;
    res.end("Not Found");
}

function configureBridgeHttpServer(server: HttpServer) {
    server.keepAliveTimeout = 1000;
    server.headersTimeout = 5000;
    server.on("connection", (socket: Socket) => {
        bridgeTcpSockets.add(socket);
        socket.on("close", () => {
            bridgeTcpSockets.delete(socket);
        });
    });
}

function attachBridgeSocketHandlers(api: OpenClawPluginApi, wsServer: WebSocketServer) {
    wsServer.on("connection", (socket: WebSocket, req) => {
        const oldSocket = getActiveBridgeSocket();
        if (oldSocket && oldSocket.readyState === oldSocket.OPEN) {
            api.logger.warn(`[WeChat] Bridge WS already connected, reject client from ${req.socket.remoteAddress}`);
            socket.close(1013, "bridge already connected");
            return;
        }
        setActiveBridgeSocket(socket);
        markBridgePong();
        api.logger.info(`[WeChat] Bridge WS connected from ${req.socket.remoteAddress}`);

        socket.on("message", async (raw) => {
            try {
                const text = raw.toString();
                const frame = JSON.parse(text);
                const event = frame?.event;
                if (event === "ping") {
                    markBridgePong();
                    socket.send(JSON.stringify(buildFrame("openclaw_to_bridge", "pong")));
                    return;
                }
                if (event === "pong") {
                    markBridgePong();
                    return;
                }
                if (event === "inbound_message") {
                    await handleInboundMessage(api, frame?.payload || {});
                    return;
                }
            } catch (err: any) {
                api.logger.error(`[WeChat] WS message error: ${err.message}`);
            }
        });

        socket.on("close", (code) => {
            if (getActiveBridgeSocket() === socket) setActiveBridgeSocket(null);
            api.logger.warn(`[WeChat] Bridge WS disconnected code=${code}`);
        });
    });
}

function createBridgeServers(api: OpenClawPluginApi, wsPath: string) {
    const httpServer = createServer((req, res) => handleBridgeHttpRequest(api, req, res));
    configureBridgeHttpServer(httpServer);

    const wsServer = new WebSocketServer({
        server: httpServer,
        path: wsPath,
    });
    attachBridgeSocketHandlers(api, wsServer);

    bridgeHttpServer = httpServer;
    bridgeWss = wsServer;
    setWechatWsServer(wsServer);
    syncStateFromModuleRefs();

    return { httpServer, wsServer };
}

async function listenBridgeHttpServer(server: HttpServer, host: string, port: number) {
    await new Promise<void>((resolve, reject) => {
        const onError = (err: Error) => {
            server.off("error", onError);
            reject(err);
        };
        server.once("error", onError);
        server.listen(port, host, () => {
            server.off("error", onError);
            resolve();
        });
    });
}

/**
 * 获取 OpenClaw 允许的临时目录，确保媒体文件不会因为路径安全策略被拦截
 */
function getAllowedTmpDir(cfg: any, logger?: { warn?: (message: string) => void }) {
    const bridgeConfig = resolveWechatExtensionConfig(cfg, logger);
    const targetDir = bridgeConfig.tmpDir
        ? path.resolve(bridgeConfig.tmpDir)
        : path.join(bridgeConfig.workspaceBase, "downloads");
    try {
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true, mode: 0o700 });
        }
        fs.accessSync(targetDir, fs.constants.W_OK);
        return targetDir;
    } catch {
        const fallback = path.join(process.cwd(), ".tmp");
        if (!fs.existsSync(fallback)) {
            fs.mkdirSync(fallback, { recursive: true, mode: 0o700 });
        }
        return fallback;
    }
}

async function handleInboundMessage(api: OpenClawPluginApi, body: any) {
    const logBody = { ...body };
    if (logBody.media?.data) {
        logBody.media = { ...logBody.media, data: `[base64 data, length: ${logBody.media.data.length}]` };
    }
    // api.logger.debug(`[WeChat] Inbound WS message: ${JSON.stringify(logBody)}`);
    const { from, fromName, content, accountId, media, groupName, senderId, senderName, isGroup: isGroupPayload } = body;

    const runtime = api.runtime;
    const cfg = runtime.config.loadConfig();

    if (runtime.channel.activity?.record) {
        runtime.channel.activity.record({
            channel: "wechat",
            accountId: accountId || "default",
            direction: "inbound",
        });
    }

    if (!from || (!content && !media)) {
        throw new Error("Missing from or content/media");
    }

    let mediaPath: string | undefined;
    let mediaType: string | undefined;
    if (media) {
        try {
            if (media.data) {
                const buffer = Buffer.from(media.data, "base64");
                const filename = media.name || `msg-${Date.now()}.bin`;
                const tmpDir = getAllowedTmpDir(cfg, api.logger);
                const dest = path.join(tmpDir, filename);
                fs.writeFileSync(dest, buffer);
                mediaPath = dest;
                mediaType = media.mime || "application/octet-stream";
            } else if (media.path && typeof media.path === "string") {
                if (media.path.startsWith("http://") || media.path.startsWith("https://")) {
                    const filename = media.name || `remote-${Date.now()}-${path.basename(new URL(media.path).pathname) || "file"}`;
                    const tmpDir = getAllowedTmpDir(cfg, api.logger);
                    const dest = path.join(tmpDir, filename);
                    api.logger.info(`[WeChat] Downloading remote media: ${media.path} -> ${dest}`);
                    const response = await fetch(media.path);
                    if (response.ok) {
                        const buffer = Buffer.from(await response.arrayBuffer());
                        fs.writeFileSync(dest, buffer);
                        mediaPath = dest;
                        mediaType = media.mime || response.headers.get("content-type") || "application/octet-stream";
                    } else {
                        api.logger.error(`[WeChat] Failed to download remote media: ${response.statusText}`);
                    }
                } else {
                    mediaPath = media.path;
                    mediaType = media.mime || "application/octet-stream";
                }
            }
        } catch (err: any) {
            api.logger.error(`[WeChat] Media error: ${err.message}`);
        }
    }

    const isGroup = (() => {
        if (from.endsWith("@chatroom")) return true;
        if (from.startsWith("wxid_")) return false;
        if (typeof isGroupPayload === "boolean") return isGroupPayload;
        return false;
    })();

    const chatType = isGroup ? "group" : "direct";
    // api.logger.debug(`[WeChat] Resolved message type: from=${from}, isGroup=${isGroup}, chatType=${chatType}`);

    const messageId = body?.messageId ? String(body.messageId) : `msg-${Date.now()}`;
    const resolvedSenderId = senderId || from;
    const resolvedSenderName = senderName || fromName || "User";
    const conversationLabel = isGroup ? (groupName || fromName || from) : resolvedSenderName;

    const peer = {
        id: from,
        kind: isGroup ? ("group" as const) : ("dm" as const),
    };

    const ctx: any = {
        channel: "wechat",
        accountId: accountId || "default",
        source: `wechat:${from}`,
        OriginatingChannel: "wechat",
        OriginatingTo: from,
        Provider: "wechat",
        Surface: "wechat",
        peer,
        author: {
            id: `wechat:${resolvedSenderId}`,
            name: resolvedSenderName,
            isBot: false,
        },
        ConversationLabel: conversationLabel,
        GroupSubject: isGroup ? (groupName || fromName || from) : undefined,
        SenderName: resolvedSenderName,
        SenderId: resolvedSenderId,
        MessageSid: messageId,
        MessageSidFull: messageId,
        From: from,
        To: accountId || "default",
        isGroup,
        ChatType: chatType,
        SessionKey: `agent:main:wechat:${chatType}:${from}`,
        threadId: from,
        content: content || "",
        Body: content || "",
        RawBody: content || "",
        CommandBody: content || "",
        MsgId: messageId,
        MediaPath: mediaPath,
        MediaType: mediaType,
        MediaPaths: mediaPath ? [mediaPath] : undefined,
        MediaUrls: (media && typeof media.path === "string" && media.path.startsWith("http")) ? [media.path] : undefined,
        MediaTypes: mediaType ? [mediaType] : undefined,
        Images: mediaPath && mediaType?.startsWith("image/") ? [mediaPath] : undefined,
        Files: mediaPath ? [{
            path: mediaPath,
            mime: mediaType || "application/octet-stream",
            name: path.basename(mediaPath)
        }] : undefined,
        msg: {
            date: Date.now(),
            chat: { id: from, type: chatType },
            text: content || "",
            from: { id: senderId || from, first_name: senderName || fromName || "User" },
        },
    };

    const dispatcher = runtime.channel.reply.createReplyDispatcherWithTyping({
        onTyping: async () => { },
    } as any);

    let sentText = "";
    const sentMediaPaths = new Set<string>();

    await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
        ctx,
        cfg,
        dispatcherOptions: {
            ...dispatcher,
            deliver: async (...args: any[]) => {
                api.logger.info(`[WeChat Debug] DELIVER ARGS: ${args.length}, TYPES: ${args.map(a => typeof a)}`);
                
                // OpenClaw dispatcher arguments order: (payload, info)
                const payload = (typeof args[0] === 'object' && args[0] !== null) ? args[0] : {};
                const info = (args.length > 1 && typeof args[1] === 'object') ? args[1] : {};
                
                const rawPayloadStr = JSON.stringify(payload);
                const textFromArg0 = (typeof args[0] === 'string' ? args[0] : "");
                api.logger.info(`[WeChat Debug] Resolved Payload: ${rawPayloadStr}, kind: ${info.kind || 'unknown'}, textArg0Len: ${textFromArg0.length}`);

                let textValue = textFromArg0 || payload.text || payload.message || payload.content || payload.answer || "";
                if (!textValue && Array.isArray(payload.blocks)) {
                    textValue = payload.blocks
                        .map((b: any) => (typeof b === "string" ? b : (b.text || b.content || "")))
                        .filter(Boolean)
                        .join("\n\n");
                }
                const fullText = (typeof textValue === "string" ? textValue : JSON.stringify(textValue)).trim();
                if (fullText.toUpperCase().includes("NO_REPLY")) {
                    api.logger.info(`[WeChat] Skipping reply due to NO_REPLY signal detected`);
                    return;
                }

                // Deduplication logic:
                // 1. Identify new text relative to what we've already sent in this turn.
                // 2. Identify new media URLs.
                let newText = fullText;
                if (sentText && fullText.startsWith(sentText)) {
                    newText = fullText.substring(sentText.length).trim();
                }

                const allMedia = [...(payload.mediaUrls || [])];
                if (payload.mediaUrl && !allMedia.includes(payload.mediaUrl)) allMedia.push(payload.mediaUrl);
                
                const hasNewMedia = allMedia.some(m => !sentMediaPaths.has(m));
                
                // Regex-based media parsing also contributes to sentMediaPaths
                // We'll process the full text if it's the first time, 
                // or just the newText if it's incremental.
                const textToProcess = (sentText && fullText.startsWith(sentText)) ? newText : fullText;
                
                if (!textToProcess && !hasNewMedia && info.kind === "final") {
                    api.logger.info(`[WeChat] Skipping redundant final reply (already sent in blocks)`);
                    return;
                }

                const logText = textToProcess.substring(0, 50).replace(/\n/g, "\\n");
                api.logger.info(`[WeChat] Delivering reply to ${from} (${chatType}): text="${logText}...", kind=${info.kind}`);

                const mediaRegex = /(?:MEDIA|FILE):([^\s]+)/g;
                let cursor = 0;
                let match;

                while ((match = mediaRegex.exec(textToProcess)) !== null) {
                    const precedingText = textToProcess.substring(cursor, match.index).trim();
                    if (precedingText && wechatPlugin.outbound?.sendText) {
                        await wechatPlugin.outbound.sendText({
                            to: from,
                            text: precedingText,
                            msg_id: messageId,
                            accountId: accountId || "default",
                            cfg,
                        } as any);
                    }
                    const mPath = match[1];
                    if (mPath && !sentMediaPaths.has(mPath)) {
                        sentMediaPaths.add(mPath);

                        if (wechatPlugin.outbound?.sendMedia) {
                            await wechatPlugin.outbound.sendMedia({
                                to: from,
                                mediaUrl: mPath,
                                text: "",
                                msg_id: messageId,
                                accountId: accountId || "default",
                                cfg,
                            } as any);
                        }
                    }
                    cursor = match.index + match[0].length;
                }

                const remainingText = textToProcess.substring(cursor).trim();
                if (remainingText && wechatPlugin.outbound?.sendText) {
                    await wechatPlugin.outbound.sendText({
                        to: from,
                        text: remainingText,
                        msg_id: messageId,
                        accountId: accountId || "default",
                        cfg,
                    } as any);
                }

                // Process explicit media urls from payload
                for (const mUrl of allMedia) {
                    if (!sentMediaPaths.has(mUrl)) {
                        sentMediaPaths.add(mUrl);
                        if (wechatPlugin.outbound?.sendMedia) {
                            await wechatPlugin.outbound.sendMedia({
                                to: from,
                                mediaUrl: mUrl,
                                text: "",
                                msg_id: messageId,
                                accountId: accountId || "default",
                                cfg,
                            } as any);
                        }
                    }
                }

                // Update turn state
                sentText = fullText;

            },
        },
    });
}


const plugin = {
    id: "wechat",
    name: "WeChat",
    description: "WeChat channel plugin (WS bridge)",
    configSchema: emptyPluginConfigSchema(),
    register(api: OpenClawPluginApi) {
        try {
            api.logger.debug(`[WeChat] Registering plugin package... (PID: ${process.pid})`);
            setWechatRuntime(api.runtime);

            const sharedState = getGlobalState();
            sharedState.runtime = api.runtime;
            syncModuleRefsFromState(sharedState);
            logBridgeState(api, "register:init", sharedState);

            api.registerChannel({ plugin: wechatPlugin });

            const startBridge = async () => {
                const runtime = api.runtime;
                const cfg = runtime.config.loadConfig();
                const bridgeConfig = resolveWechatExtensionConfig(cfg, api.logger);
                const wsConfig = {
                    host: bridgeConfig.wsHost,
                    port: bridgeConfig.wsPort,
                    path: bridgeConfig.wsPath,
                };

                api.logger.debug(`[WeChat] Bridge Config: host=${wsConfig.host}, port=${wsConfig.port}, path=${wsConfig.path}`);
                logBridgeState(api, "start:before-wait");

                if (bridgeClosePromise) {
                    api.logger.debug("[WeChat] Waiting for previous bridge shutdown to finish before starting.");
                    await bridgeClosePromise;
                    logBridgeState(api, "start:after-wait");
                }

                const state = getGlobalState();
                syncModuleRefsFromState(state);
                if ((bridgeWss || state.wsServer || bridgeHttpServer || state.httpServer) && !(bridgeHttpServer?.listening || state.httpServer?.listening)) {
                    api.logger.warn("[WeChat] Found stale bridge objects during startup, cleaning them up first.");
                    logBridgeState(api, "start:stale-before-cleanup", state);
                    await closeBridgeResources(api, "startup stale cleanup");
                    syncModuleRefsFromState(state);
                    logBridgeState(api, "start:stale-after-cleanup", state);
                }

                if ((bridgeWss && bridgeHttpServer?.listening) || (state.wsServer && state.httpServer?.listening)) {
                    api.logger.debug("[WeChat] Reusing existing WS bridge server instance.");
                    syncModuleRefsFromState(state);
                    logBridgeState(api, "start:reuse-existing", state);
                    return;
                }
                createBridgeServers(api, wsConfig.path);
                logBridgeState(api, "start:servers-created", state);

                try {
                    if (!bridgeHttpServer) {
                        throw new Error("bridge http server not initialized");
                    }
                    await listenBridgeHttpServer(bridgeHttpServer, wsConfig.host, wsConfig.port);
                    api.logger.info(`[WeChat] WS bridge listening at ws://${wsConfig.host}:${wsConfig.port}${wsConfig.path}`);
                    logBridgeState(api, "start:listening", state);
                } catch (err: any) {
                    if (err?.code === "EADDRINUSE") {
                        api.logger.warn(`[WeChat] Port ${wsConfig.port} is busy during startup, trying one delayed retry after cleanup.`);
                        logBridgeState(api, "start:eaddrinuse-before-cleanup", state);
                        await closeBridgeResources(api, "startup retry cleanup");
                        await sleep(1200);
                        createBridgeServers(api, wsConfig.path);
                        logBridgeState(api, "start:retry-servers-created", state);

                        try {
                            if (!bridgeHttpServer) {
                                throw new Error("bridge http server not initialized");
                            }
                            await listenBridgeHttpServer(bridgeHttpServer, wsConfig.host, wsConfig.port);
                            api.logger.info(`[WeChat] WS bridge listening at ws://${wsConfig.host}:${wsConfig.port}${wsConfig.path} (retry success)`);
                            logBridgeState(api, "start:retry-listening", state);
                        } catch (retryErr: any) {
                            api.logger.warn(`[WeChat] CRITICAL: Port ${wsConfig.port} is still busy after retry. Another process is likely holding it.`);
                            logBridgeState(api, "start:retry-failed", state);
                            await closeBridgeResources(api, "startup retry failed");
                            return;
                        }
                    }
                    else {
                        throw err;
                    }
                }

                bridgeHeartbeatTimer = setInterval(() => {
                    const socket = getActiveBridgeSocket();
                    if (!socket || socket.readyState !== socket.OPEN) return;
                    if (Date.now() - getBridgeLastPongAt() > 70000) {
                        api.logger.warn("[WeChat] Bridge heartbeat timeout, closing");
                        socket.close(1001, "heartbeat timeout");
                        return;
                    }
                    socket.send(JSON.stringify(buildFrame("openclaw_to_bridge", "ping")));
                }, 30000);

                syncStateFromModuleRefs(state);
                logBridgeState(api, "start:heartbeat-ready", state);
            };

            startBridge().catch(err => {
                clearBridgeStateRefs(sharedState);
                clearBridgeRuntimeState();
                logBridgeState(api, "start:failed-cleared", sharedState);
                api.logger.error(`[WeChat] Bridge start failure: ${err.message}`);
            });

            api.logger.debug("[WeChat] Registration complete.");
        } catch (err: any) {
            api.logger.error(`[WeChat] Registration error: ${err.message}`);
        }
    },
    unregister(api: OpenClawPluginApi) {
        logBridgeState(api, "unregister:before");
        void closeBridgeResources(api, "plugin unregister");
    }
};

export default plugin;
