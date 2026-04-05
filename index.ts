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
    bindWechatToolAuthToRun,
    clearWechatToolAuthForRun,
    clearWechatToolAuthForSession,
    clearBridgeRuntimeState,
    enqueueWechatInboundToolAuth,
    getActiveBridgeSocket,
    getBridgeLastPongAt,
    markBridgePong,
    getWechatToolAuthForRun,
    inheritWechatToolAuthForChildSession,
    promoteWechatToolAuthForDispatch,
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

function collapseExactRepeatedReplyText(text: string): string {
    const normalized = text.replace(/\r\n/g, "\n").trim();
    if (normalized.length < 40) {
        return normalized;
    }

    const divisors: number[] = [];
    for (let unitLength = 20; unitLength <= Math.floor(normalized.length / 2); unitLength++) {
        if (normalized.length % unitLength === 0) {
            divisors.push(unitLength);
        }
    }

    divisors.sort((a, b) => b - a);
    for (const unitLength of divisors) {
        const repeatCount = normalized.length / unitLength;
        if (repeatCount < 2) {
            continue;
        }

        const unit = normalized.slice(0, unitLength);
        if (unit.repeat(repeatCount) === normalized) {
            return unit.trim();
        }
    }

    return normalized;
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

function normalizeGuardedToolNameList(value: string[] | undefined): Set<string> {
    return new Set(
        (value || [])
            .map((entry) => entry.trim().toLowerCase())
            .filter(Boolean),
    );
}

function normalizeWechatIdAllowList(value: string[] | undefined): Set<string> {
    return new Set(
        (value || [])
            .map((entry) => entry.trim().toLowerCase())
            .filter(Boolean),
    );
}

function resolveWechatToolBypassMatch(
    allowList: Set<string>,
    authContext: {
        senderId?: string;
        from?: string;
    },
): { matched: boolean; kind?: "senderId" | "from"; value?: string } {
    const senderId = authContext.senderId?.trim().toLowerCase();
    if (senderId && allowList.has(senderId)) {
        return {
            matched: true,
            kind: "senderId",
            value: authContext.senderId,
        };
    }

    const from = authContext.from?.trim().toLowerCase();
    if (from && allowList.has(from)) {
        return {
            matched: true,
            kind: "from",
            value: authContext.from,
        };
    }

    return { matched: false };
}

function getWechatToolSpecificAllowList(
    config: ReturnType<typeof resolveWechatExtensionConfig>,
    toolName: string,
): Set<string> {
    const entries = config.toolAuthBypassByTool?.[toolName] || [];
    return normalizeWechatIdAllowList(entries);
}

function summarizeWechatToolAuthRecord(entry: {
    from?: string;
    chatType?: string;
    conversationLabel?: string;
    senderId?: string;
    senderName?: string;
    content?: string;
}): string {
    const parts: string[] = [];
    if (entry.chatType) {
        parts.push(`chatType=${entry.chatType}`);
    }
    if (entry.from) {
        parts.push(`from=${entry.from}`);
    }
    if (entry.conversationLabel) {
        parts.push(`conversation="${summarizeWechatTextForLog(entry.conversationLabel, 80)}"`);
    }
    if (entry.senderId) {
        parts.push(`sender=${entry.senderId}`);
    }
    if (entry.senderName && entry.senderName !== entry.senderId) {
        parts.push(`senderName="${summarizeWechatTextForLog(entry.senderName, 80)}"`);
    }
    if (entry.content) {
        parts.push(`text="${summarizeWechatTextForLog(entry.content, 120)}"`);
    }
    return parts.join(" ");
}

type WechatToolNoticeState =
    | "queued"
    | "allow-once"
    | "allow-always"
    | "deny"
    | "timeout"
    | "cancelled"
    | "blocked";

type WechatToolNoticeContext = {
    from?: string;
    accountId?: string;
    messageId?: string;
    chatType?: "group" | "direct";
    conversationLabel?: string;
    senderId?: string;
    senderName?: string;
    content?: string;
};

function getWechatToolNoticeStateLabel(state: WechatToolNoticeState): string {
    switch (state) {
        case "queued":
            return "已提交审批";
        case "allow-once":
            return "本次已批准";
        case "allow-always":
            return "已设为总是允许";
        case "deny":
            return "审批被拒绝";
        case "timeout":
            return "审批超时";
        case "cancelled":
            return "审批已取消";
        case "blocked":
            return "无权限";
        default:
            return state;
    }
}

function getWechatChatTypeLabel(chatType?: string): string {
    return chatType === "group" ? "群聊" : "私聊";
}

function renderWechatToolNoticeTemplate(template: string, params: {
    toolName: string;
    state: WechatToolNoticeState;
    authContext: WechatToolNoticeContext;
}): string {
    const replacements: Record<string, string> = {
        toolName: params.toolName,
        state: params.state,
        stateLabel: getWechatToolNoticeStateLabel(params.state),
        senderId: params.authContext.senderId || "",
        senderName: params.authContext.senderName || "",
        from: params.authContext.from || "",
        chatType: params.authContext.chatType || "",
        chatTypeLabel: getWechatChatTypeLabel(params.authContext.chatType),
        conversationLabel: params.authContext.conversationLabel || "",
        question: params.authContext.content || "",
    };
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
        return replacements[key] ?? "";
    }).trim();
}

function buildWechatToolApprovalDescription(toolName: string, authContext: {
    from?: string;
    accountId?: string;
    chatType?: string;
    conversationLabel?: string;
    senderId?: string;
    senderName?: string;
    content?: string;
}): string {
    const location = authContext.chatType === "group"
        ? `群 "${authContext.conversationLabel || authContext.from || "unknown"}"`
        : "私聊";
    const sender = authContext.senderName && authContext.senderName !== authContext.senderId
        ? `${authContext.senderName} (${authContext.senderId || "unknown"})`
        : (authContext.senderId || authContext.senderName || "unknown");
    const lines = [
        `${location} 中的微信发送者 ${sender} 请求执行工具 "${toolName}"。`,
    ];
    const questionPreview = summarizeWechatTextForLog(authContext.content, 200);
    if (questionPreview) {
        lines.push(`原始消息: ${questionPreview}`);
    }
    lines.push("批准一次后继续当前运行。");
    return lines.join("\n");
}

function buildWechatToolNoticeText(params: {
    toolName: string;
    state: WechatToolNoticeState;
    authContext: WechatToolNoticeContext;
    config: ReturnType<typeof resolveWechatExtensionConfig>;
}): string {
    const customTemplate = (() => {
        switch (params.state) {
            case "queued":
                return params.config.toolAuthMessageQueued;
            case "allow-once":
                return params.config.toolAuthMessageAllowOnce;
            case "allow-always":
                return params.config.toolAuthMessageAllowAlways;
            case "deny":
                return params.config.toolAuthMessageDeny;
            case "timeout":
                return params.config.toolAuthMessageTimeout;
            case "cancelled":
                return params.config.toolAuthMessageCancelled;
            case "blocked":
                return params.config.toolAuthMessageBlocked;
            default:
                return undefined;
        }
    })();
    if (customTemplate) {
        return renderWechatToolNoticeTemplate(customTemplate, params);
    }

    const toolLabel = params.toolName;
    switch (params.state) {
        case "queued":
            return `检测到敏感工具申请: ${toolLabel}\n已提交审批，请稍候。`;
        case "allow-once":
            return `敏感工具审批已通过: ${toolLabel}\n本次执行继续进行。`;
        case "allow-always":
            return `敏感工具审批已设为总是允许: ${toolLabel}\n当前执行继续进行。`;
        case "deny":
            return `敏感工具审批被拒绝: ${toolLabel}\n本次不会执行。`;
        case "timeout":
            return `敏感工具审批超时: ${toolLabel}\n本次不会执行。`;
        case "cancelled":
            return `敏感工具审批已取消: ${toolLabel}\n本次不会执行。`;
        case "blocked":
            return `你没有权限调用敏感工具: ${toolLabel}\n如需执行，请由主人微信发起，或改成审批模式。`;
        default:
            return `敏感工具状态已更新: ${toolLabel}`;
    }
}

function shouldSendWechatToolAuthNotice(config: ReturnType<typeof resolveWechatExtensionConfig>, params: {
    state: WechatToolNoticeState;
    chatType?: "group" | "direct";
}): boolean {
    if (params.chatType === "group" && !config.toolAuthNotifyInGroup) {
        return false;
    }
    if (params.chatType !== "group" && !config.toolAuthNotifyInDirect) {
        return false;
    }
    if (params.state === "blocked") {
        return config.toolAuthNotifyBlocked;
    }
    if (params.state === "queued") {
        return config.toolAuthNotifyApprovalQueued;
    }
    return config.toolAuthNotifyApprovalResolved;
}

async function sendWechatToolAuthNotice(api: OpenClawPluginApi, authContext: {
    from?: string;
    accountId?: string;
    messageId?: string;
}, text: string): Promise<void> {
    const to = authContext.from?.trim();
    if (!to || !text.trim()) {
        return;
    }
    try {
        const cfg = api.runtime.config.loadConfig();
        await wechatPlugin.outbound?.sendText?.({
            to,
            text,
            msg_id: authContext.messageId,
            accountId: authContext.accountId || "default",
            cfg,
        } as any);
    } catch (error: any) {
        api.logger.warn?.(`[WeChat ToolAuth] Failed to send notice to ${to}: ${error?.message || String(error)}`);
    }
}

function shouldApplyWechatToolAuth(params: {
    sessionKey?: string;
}): boolean {
    return params.sessionKey?.includes(":wechat:") === true;
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
    const {
        from,
        fromName,
        content,
        accountId,
        media,
        groupName,
        senderId,
        senderName,
        isGroup: isGroupPayload,
        isMaster: isMasterPayload,
    } = body;

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
    const isMaster = isMasterPayload === true;
    // api.logger.debug(`[WeChat] Resolved message type: from=${from}, isGroup=${isGroup}, chatType=${chatType}`);

    const messageId = body?.messageId ? String(body.messageId) : `msg-${Date.now()}`;
    const resolvedSenderId = senderId || from;
    const resolvedSenderName = senderName || fromName || "User";
    const conversationLabel = isGroup ? (groupName || fromName || from) : resolvedSenderName;
    const inboundTextPreview = summarizeWechatTextForLog(content);
    const inboundMediaSummary = media
        ? `media=${media.mime || media.type || "unknown"}:${media.name || media.path || "[inline]"}`
        : "";
    const conversationNameSummary = conversationLabel && conversationLabel !== from
        ? ` conversation="${summarizeWechatTextForLog(conversationLabel, 80)}"`
        : "";
    const senderNameSummary = resolvedSenderName && resolvedSenderName !== resolvedSenderId
        ? ` senderName="${summarizeWechatTextForLog(resolvedSenderName, 80)}"`
        : "";
    api.logger.info(
        `[WeChat Inbound] from=${from} sender=${resolvedSenderId} chatType=${chatType} isMaster=${isMaster} msgId=${messageId}` +
        `${conversationNameSummary}` +
        `${senderNameSummary}` +
        `${inboundTextPreview ? ` text="${inboundTextPreview}"` : ""}` +
        `${inboundMediaSummary ? ` ${inboundMediaSummary}` : ""}`,
    );

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
            isMaster,
        },
        ConversationLabel: conversationLabel,
        GroupSubject: isGroup ? (groupName || fromName || from) : undefined,
        SenderName: resolvedSenderName,
        SenderId: resolvedSenderId,
        OwnerAllowFrom: isMaster ? [resolvedSenderId] : undefined,
        isMaster,
        IsMaster: isMaster,
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

    enqueueWechatInboundToolAuth({
        sessionKey: ctx.SessionKey,
        from,
        accountId: accountId || "default",
        chatType,
        conversationLabel,
        senderId: resolvedSenderId,
        senderName: resolvedSenderName,
        isMaster,
        content: content || "",
        messageId,
        createdAt: Date.now(),
    });

    const dispatcher = runtime.channel.reply.createReplyDispatcherWithTyping({
        onTyping: async () => { },
    } as any);

    let cumulativeSentText = "";
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
                const rawFullText = typeof textValue === "string" ? textValue : JSON.stringify(textValue);
                const fullText = collapseExactRepeatedReplyText(rawFullText);
                if (fullText !== rawFullText.trim()) {
                    api.logger.info(
                        `[WeChat] Collapsed duplicated reply text from ${rawFullText.trim().length} chars to ${fullText.length} chars`,
                    );
                }
                if (fullText.toUpperCase().includes("NO_REPLY")) {
                    api.logger.info(`[WeChat] Skipping reply due to NO_REPLY signal detected`);
                    return;
                }

                // Deduplication logic:
                // 1. Identify new text relative to what we've already sent in this turn.
                // 2. Identify new media URLs.
                let newText = fullText;
                if (cumulativeSentText && fullText.startsWith(cumulativeSentText)) {
                    newText = fullText.substring(cumulativeSentText.length);
                }
                newText = collapseExactRepeatedReplyText(newText);

                const allMedia = [...(payload.mediaUrls || [])];
                if (payload.mediaUrl && !allMedia.includes(payload.mediaUrl)) allMedia.push(payload.mediaUrl);
                
                const hasNewMedia = allMedia.some(m => !sentMediaPaths.has(m));
                
                // Regex-based media parsing also contributes to sentMediaPaths
                // We'll process the full text if it's the first time, 
                // or just the newText if it's incremental.
                const textToProcess = newText;
                
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
                if (textToProcess) {
                    cumulativeSentText += textToProcess;
                }

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

            api.on("before_dispatch", (event, ctx) => {
                if (!shouldApplyWechatToolAuth({ sessionKey: ctx.sessionKey })) {
                    return;
                }

                promoteWechatToolAuthForDispatch({
                    sessionKey: ctx.sessionKey!,
                    senderId: ctx.senderId || event.senderId,
                    content: event.body || event.content,
                });

                return;
            }, { priority: 100 });

            api.on("before_agent_start", (_event, ctx) => {
                if (!ctx.runId || !ctx.sessionKey) {
                    return;
                }
                bindWechatToolAuthToRun({
                    sessionKey: ctx.sessionKey,
                    runId: ctx.runId,
                });
                return;
            }, { priority: 100 });

            api.on("before_tool_call", (event, ctx) => {
                if (!ctx.runId) {
                    return;
                }

                const cfg = api.runtime.config.loadConfig();
                const bridgeConfig = resolveWechatExtensionConfig(cfg, api.logger);
                const guardedTools = normalizeGuardedToolNameList(bridgeConfig.nonOwnerToolAuthTools);
                const bypassWxids = normalizeWechatIdAllowList(bridgeConfig.toolAuthBypassWxids);
                const toolName = event.toolName.trim().toLowerCase();
                const toolSpecificBypassWxids = getWechatToolSpecificAllowList(bridgeConfig, toolName);
                const authContext = getWechatToolAuthForRun(ctx.runId);

                if (!guardedTools.has(toolName) || !authContext) {
                    return;
                }

                const authSummary = summarizeWechatToolAuthRecord(authContext);
                const generalBypassMatch = resolveWechatToolBypassMatch(bypassWxids, authContext);
                const toolSpecificBypassMatch = resolveWechatToolBypassMatch(toolSpecificBypassWxids, authContext);
                const bypassMatch = generalBypassMatch.matched ? generalBypassMatch : toolSpecificBypassMatch;
                const bypassSource = generalBypassMatch.matched
                    ? "whitelist-global"
                    : (toolSpecificBypassMatch.matched ? `whitelist-tool:${toolName}` : undefined);
                const isBypassWxid = bypassMatch.matched;

                if (authContext.isMaster || isBypassWxid) {
                    if (
                        toolName === "exec" &&
                        bridgeConfig.ownerExecBypassApproval &&
                        event.params &&
                        typeof event.params === "object"
                    ) {
                        api.logger.info(
                            `[WeChat ToolAuth] Trusted bypass tool=${toolName} runId=${ctx.runId} source=${authContext.isMaster ? "master" : `${bypassSource || "whitelist"}:${bypassMatch.kind || "unknown"}`} ${authSummary}`,
                        );
                        return {
                            params: {
                                ...event.params,
                                ask: "off",
                            },
                        };
                    }
                    if (isBypassWxid) {
                        api.logger.info(
                            `[WeChat ToolAuth] Whitelist bypass tool=${toolName} runId=${ctx.runId} source=${bypassSource || "whitelist"} matchedBy=${bypassMatch.kind || "unknown"} value=${bypassMatch.value || ""} ${authSummary}`,
                        );
                    }
                    return;
                }

                if (bridgeConfig.nonOwnerToolAuthMode === "deny") {
                    api.logger.warn(
                        `[WeChat ToolAuth] Denied tool=${toolName} runId=${ctx.runId} ${authSummary}`,
                    );
                    if (shouldSendWechatToolAuthNotice(bridgeConfig, {
                        state: "blocked",
                        chatType: authContext.chatType,
                    })) {
                        void sendWechatToolAuthNotice(
                            api,
                            authContext,
                            buildWechatToolNoticeText({
                                toolName,
                                state: "blocked",
                                authContext,
                                config: bridgeConfig,
                            }),
                        );
                    }
                    return {
                        block: true,
                        blockReason: `WeChat sender ${authContext.senderId || "unknown"} is not authorized to use ${toolName}.`,
                    };
                }

                if (bridgeConfig.nonOwnerToolAuthMode === "approve") {
                    api.logger.warn(
                        `[WeChat ToolAuth] Approval required tool=${toolName} runId=${ctx.runId} ${authSummary}`,
                    );
                    if (shouldSendWechatToolAuthNotice(bridgeConfig, {
                        state: "queued",
                        chatType: authContext.chatType,
                    })) {
                        void sendWechatToolAuthNotice(
                            api,
                            authContext,
                            buildWechatToolNoticeText({
                                toolName,
                                state: "queued",
                                authContext,
                                config: bridgeConfig,
                            }),
                        );
                    }
                    return {
                        params:
                            toolName === "exec"
                                ? {
                                    ...event.params,
                                    ask: "off",
                                }
                                : event.params,
                        requireApproval: {
                            title: `Approve WeChat ${toolName}`,
                            description: buildWechatToolApprovalDescription(toolName, authContext),
                            severity: toolName === "exec" ? "critical" : "warning",
                            timeoutMs: 120000,
                            timeoutBehavior: "deny",
                            onResolution: (decision) => {
                                api.logger.info(
                                    `[WeChat ToolAuth] Approval resolved tool=${toolName} runId=${ctx.runId} decision=${decision} ${authSummary}`,
                                );
                                const resolvedState: WechatToolNoticeState =
                                    decision === "allow-once" ||
                                    decision === "allow-always" ||
                                    decision === "deny" ||
                                    decision === "timeout" ||
                                    decision === "cancelled"
                                        ? decision
                                        : "cancelled";
                                if (shouldSendWechatToolAuthNotice(bridgeConfig, {
                                    state: resolvedState,
                                    chatType: authContext.chatType,
                                })) {
                                    void sendWechatToolAuthNotice(
                                        api,
                                        authContext,
                                        buildWechatToolNoticeText({
                                            toolName,
                                            state: resolvedState,
                                            authContext,
                                            config: bridgeConfig,
                                        }),
                                    );
                                }
                            },
                        },
                    };
                }

                return;
            }, { priority: 100 });

            api.on("agent_end", (_event, ctx) => {
                if (ctx.runId) {
                    clearWechatToolAuthForRun(ctx.runId);
                }
            }, { priority: 100 });

            api.on("subagent_spawned", (_event, ctx) => {
                if (!ctx.childSessionKey || !ctx.requesterSessionKey) {
                    return;
                }
                inheritWechatToolAuthForChildSession({
                    requesterSessionKey: ctx.requesterSessionKey,
                    childSessionKey: ctx.childSessionKey,
                });
            }, { priority: 100 });

            api.on("session_end", (_event, ctx) => {
                if (ctx.sessionKey) {
                    clearWechatToolAuthForSession(ctx.sessionKey);
                }
            }, { priority: 100 });

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
