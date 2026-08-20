import { WebSocket, WebSocketServer } from "ws";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { resolveWechatExtensionConfig } from "./config.js";
import {
    clearBridgeRuntimeState,
    getActiveBridgeSocket,
    getBridgeLastPongAt,
    markBridgePong,
    setActiveBridgeSocket,
    setWechatWsServer,
} from "./runtime.js";

let bridgeWss: WebSocketServer | null = null;
let bridgeHeartbeatTimer: NodeJS.Timeout | null = null;
let bridgeClosePromise: Promise<void> | null = null;
let bridgeClientReconnectTimer: NodeJS.Timeout | null = null;

const globalSym = Symbol.for("openclaw.wechat.bridge.state");
const DUPLICATE_REGISTER_RECOVERY_COOLDOWN_MS = 5_000;
const DUPLICATE_REGISTER_RECOVERY_LOG_INTERVAL_MS = 30_000;

export type WechatBridgeGlobalState = {
    runtime: OpenClawPluginApi["runtime"] | null;
    wsServer: WebSocketServer | null;
    activeSocket: WebSocket | null;
    lastPongAt: number;
    heartbeatTimer: NodeJS.Timeout | null;
    closing: boolean;
    startPromise: Promise<void> | null;
    registering: boolean;
    registered: boolean;
    duplicateRegisterCount: number;
    lastDuplicateRegisterLogAt: number;
    lastRecoveryAttemptAt: number;
    lastRecoveryLogAt: number;
    boundApis: Set<object>;
    clientConnecting?: boolean;
};

export type WechatBridgeInboundHandler = (
    api: OpenClawPluginApi,
    body: any,
) => Promise<void> | void;

export function getWechatBridgeGlobalState(): WechatBridgeGlobalState {
    // OpenClaw can evaluate an extension in more than one VM context during
    // plugin reload. `globalThis` is context-local in that case, so keeping
    // this state there creates one WebSocket per context. `process` is shared
    // by all extension contexts in the gateway process.
    const processHolder = process as unknown as Record<symbol, any>;
    const legacyHolder = globalThis as Record<symbol, any>;
    const existing = (processHolder[globalSym] ??= legacyHolder[globalSym] ?? {});
    legacyHolder[globalSym] = existing;
    if (!("runtime" in existing)) existing.runtime = null;
    if (!("wsServer" in existing)) existing.wsServer = null;
    if (!("activeSocket" in existing)) existing.activeSocket = null;
    if (!("lastPongAt" in existing)) existing.lastPongAt = 0;
    if (!("heartbeatTimer" in existing)) existing.heartbeatTimer = null;
    if (!("closing" in existing)) existing.closing = false;
    if (!("startPromise" in existing)) existing.startPromise = null;
    if (!("registering" in existing)) existing.registering = false;
    if (!("registered" in existing)) existing.registered = false;
    if (!("duplicateRegisterCount" in existing)) existing.duplicateRegisterCount = 0;
    if (!("lastDuplicateRegisterLogAt" in existing)) existing.lastDuplicateRegisterLogAt = 0;
    if (!("lastRecoveryAttemptAt" in existing)) existing.lastRecoveryAttemptAt = 0;
    if (!("lastRecoveryLogAt" in existing)) existing.lastRecoveryLogAt = 0;
    if (!(existing.boundApis instanceof Set)) existing.boundApis = new Set<object>();
    if (!("clientConnecting" in existing)) existing.clientConnecting = false;
    return existing as WechatBridgeGlobalState;
}

export function markWechatApiBound(api: OpenClawPluginApi): boolean {
    const state = getWechatBridgeGlobalState();
    const apiRef = api as object;
    if (state.boundApis.has(apiRef)) {
        return false;
    }
    state.boundApis.add(apiRef);
    return true;
}

export function syncWechatBridgeModuleRefsFromState(
    state = getWechatBridgeGlobalState(),
): void {
    bridgeWss = state.wsServer;
    bridgeHeartbeatTimer = state.heartbeatTimer;
}

function syncStateFromModuleRefs(state = getWechatBridgeGlobalState()): void {
    state.wsServer = bridgeWss;
    state.heartbeatTimer = bridgeHeartbeatTimer;
}

function clearModuleRefs(): void {
    bridgeWss = null;
    bridgeHeartbeatTimer = null;
    if (bridgeClientReconnectTimer) {
        clearTimeout(bridgeClientReconnectTimer);
        bridgeClientReconnectTimer = null;
    }
}

function clearBridgeStateRefs(state = getWechatBridgeGlobalState()): void {
    clearModuleRefs();
    state.wsServer = null;
    state.heartbeatTimer = null;
    state.startPromise = null;
}

function formatBridgeStateSnapshot(state = getWechatBridgeGlobalState()): string {
    const activeSocket = getActiveBridgeSocket();
    return [
        `closing=${state.closing}`,
        `hasHttp=false`,
        `httpListening=false`,
        `hasWs=${Boolean(state.wsServer)}`,
        `wsClients=${state.wsServer?.clients?.size ?? 0}`,
        `hasHeartbeat=${Boolean(state.heartbeatTimer)}`,
        `hasActiveSocket=${Boolean(activeSocket)}`,
        `activeSocketState=${activeSocket?.readyState ?? "none"}`,
        `clientConnecting=${Boolean(state.clientConnecting)}`,
        `hasClosePromise=${Boolean(bridgeClosePromise)}`,
    ].join(", ");
}

export function logWechatBridgeState(
    api: OpenClawPluginApi | undefined,
    phase: string,
    state = getWechatBridgeGlobalState(),
): void {
    api?.logger.debug?.(`[WeChat] Bridge state (${phase}): ${formatBridgeStateSnapshot(state)}`);
}

export function hasActiveWechatBridgeClient(state = getWechatBridgeGlobalState()): boolean {
    const activeSocket = getActiveBridgeSocket();
    return Boolean(
        state.clientConnecting ||
        (activeSocket && activeSocket.readyState === WebSocket.OPEN),
    );
}

function buildFrame(
    direction: "openclaw_to_bridge",
    event: "ping" | "pong",
    payload: Record<string, unknown> = {},
) {
    return {
        direction,
        event,
        payload,
        ts: Date.now(),
    };
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

export async function closeWechatBridgeResources(
    api?: OpenClawPluginApi,
    reason = "shutdown",
): Promise<void> {
    if (bridgeClosePromise) {
        return bridgeClosePromise;
    }

    const state = getWechatBridgeGlobalState();
    syncWechatBridgeModuleRefsFromState(state);
    state.closing = true;
    logWechatBridgeState(api, `close:start:${reason}`, state);

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

        clearModuleRefs();
        clearBridgeRuntimeState();
        logWechatBridgeState(api, `close:done:${reason}`, state);
        api?.logger.debug?.(`[WeChat] Bridge resources closed (${reason})`);
    })().finally(() => {
        state.closing = false;
        bridgeClosePromise = null;
    });

    return bridgeClosePromise;
}

function attachBridgeClientSocketHandlers(
    api: OpenClawPluginApi,
    socket: WebSocket,
    onInboundMessage: WechatBridgeInboundHandler,
): void {
    setActiveBridgeSocket(socket);
    markBridgePong();

    socket.on("pong", () => {
        markBridgePong();
    });

    socket.on("ping", () => {
        markBridgePong();
    });

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
                await onInboundMessage(api, frame?.payload || {});
                return;
            }
        } catch (err: any) {
            api.logger.error(`[WeChat] WS message error: ${err.message}`);
        }
    });

    socket.on("close", (code) => {
        const state = getWechatBridgeGlobalState();
        const wasActiveSocket = getActiveBridgeSocket() === socket;
        if (wasActiveSocket) {
            setActiveBridgeSocket(null);
            state.clientConnecting = false;
            api.logger.warn(`[WeChat] Bridge WS disconnected code=${code}`);
            scheduleBridgeClientReconnect(api, "socket-close", onInboundMessage);
            return;
        }
        api.logger.debug?.(`[WeChat] Ignoring stale bridge socket close code=${code}`);
    });

    socket.on("error", (err: any) => {
        api.logger.warn(`[WeChat] Bridge WS client error: ${err?.message || err}`);
    });
}

function initializeBridgeClientState(): void {
    bridgeWss = null;
    setWechatWsServer(null);
    syncStateFromModuleRefs();
}

type WechatBridgeWsConfig = {
    host: string;
    port: number;
    path: string;
};

function installBridgeHeartbeat(
    api: OpenClawPluginApi,
    state = getWechatBridgeGlobalState(),
): void {
    if (bridgeHeartbeatTimer) {
        clearInterval(bridgeHeartbeatTimer);
        bridgeHeartbeatTimer = null;
    }

    bridgeHeartbeatTimer = setInterval(() => {
        const socket = getActiveBridgeSocket();
        if (!socket || socket.readyState !== socket.OPEN) return;
        if (Date.now() - getBridgeLastPongAt() > 70000) {
            api.logger.warn("[WeChat] Bridge heartbeat timeout, closing");
            socket.close(1001, "heartbeat timeout");
            return;
        }
        try {
            socket.ping();
        } catch (err: any) {
            api.logger.warn(`[WeChat] Bridge heartbeat ping failed: ${err?.message || err}`);
        }
    }, 30000);

    state.heartbeatTimer = bridgeHeartbeatTimer;
}

function buildWechatBridgeServerUrl(wsConfig: WechatBridgeWsConfig): string {
    return `ws://${wsConfig.host}:${wsConfig.port}${wsConfig.path}`;
}

function scheduleBridgeClientReconnect(
    api: OpenClawPluginApi,
    reason: string,
    onInboundMessage: WechatBridgeInboundHandler,
): void {
    const state = getWechatBridgeGlobalState();
    if (bridgeClientReconnectTimer || bridgeClosePromise || hasActiveWechatBridgeClient(state)) {
        return;
    }
    api.logger.info(`[WeChat] Scheduling bridge reconnect (${reason})`);
    bridgeClientReconnectTimer = setTimeout(() => {
        bridgeClientReconnectTimer = null;
        void ensureWechatBridgeStarted(api, onInboundMessage).catch((err) => {
            handleBridgeStartFailure(api, err, onInboundMessage);
        });
    }, 2000);
}

async function connectBridgeClient(
    api: OpenClawPluginApi,
    wsConfig: WechatBridgeWsConfig,
    onInboundMessage: WechatBridgeInboundHandler,
): Promise<void> {
    const state = getWechatBridgeGlobalState();
    if (state.clientConnecting) {
        return;
    }
    const activeSocket = getActiveBridgeSocket();
    if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
        return;
    }
    if (activeSocket) {
        try {
            activeSocket.terminate();
        } catch { }
        setActiveBridgeSocket(null);
    }

    state.clientConnecting = true;
    const targetUrl = buildWechatBridgeServerUrl(wsConfig);
    await new Promise<void>((resolve, reject) => {
        const socket = new WebSocket(targetUrl);
        let settled = false;

        const finishResolve = () => {
            if (settled) return;
            settled = true;
            state.clientConnecting = false;
            resolve();
        };
        const finishReject = (err: Error) => {
            if (settled) return;
            settled = true;
            state.clientConnecting = false;
            reject(err);
        };

        socket.once("open", () => {
            // A reconnect can race with a plugin reload. Keep exactly one
            // socket authoritative and actively release the replaced one.
            const previousSocket = getActiveBridgeSocket();
            if (previousSocket && previousSocket !== socket) {
                try {
                    previousSocket.terminate();
                } catch { }
            }
            attachBridgeClientSocketHandlers(api, socket, onInboundMessage);
            api.logger.info(`[WeChat] Bridge WS connected: ${targetUrl}`);
            finishResolve();
        });
        socket.once("error", (err: any) => {
            try {
                socket.close();
            } catch { }
            api.logger.warn(
                `[WeChat] Bridge WS socket connect error to ${targetUrl}: `
                + `${err instanceof Error ? err.message : String(err)}`,
            );
            finishReject(err instanceof Error ? err : new Error(String(err)));
        });
    });
}

function handleBridgeStartFailure(
    api: OpenClawPluginApi,
    err: unknown,
    onInboundMessage: WechatBridgeInboundHandler,
): void {
    const state = getWechatBridgeGlobalState();
    clearBridgeStateRefs(state);
    clearBridgeRuntimeState();
    logWechatBridgeState(api, "start:failed-cleared", state);
    api.logger.error(
        `[WeChat] Bridge start failure: ${err instanceof Error ? err.message : String(err)}`,
    );
    if (!state.closing) {
        scheduleBridgeClientReconnect(api, "start-failure", onInboundMessage);
    }
}

async function ensureWechatBridgeStarted(
    api: OpenClawPluginApi,
    onInboundMessage: WechatBridgeInboundHandler,
): Promise<void> {
    const startState = getWechatBridgeGlobalState();
    if (startState.startPromise) {
        await startState.startPromise;
        return;
    }

    const performStart = async () => {
        const runtime = api.runtime;
        const cfg = (typeof runtime?.config?.current === "function" ? runtime.config.current() : (api as any)?.config) || {};
        const bridgeConfig = resolveWechatExtensionConfig(cfg, api.logger);
        const wsConfig: WechatBridgeWsConfig = {
            host: bridgeConfig.wsHost,
            port: bridgeConfig.wsPort,
            path: bridgeConfig.wsPath,
        };

        api.logger.debug(
            `[WeChat] Bridge Config: wsHost=${wsConfig.host}, wsPort=${wsConfig.port}, wsPath=${wsConfig.path}`,
        );
        logWechatBridgeState(api, "start:before-wait");

        if (bridgeClosePromise) {
            api.logger.debug("[WeChat] Waiting for previous bridge shutdown to finish before starting.");
            await bridgeClosePromise;
            logWechatBridgeState(api, "start:after-wait");
        }

        const state = getWechatBridgeGlobalState();
        syncWechatBridgeModuleRefsFromState(state);

        initializeBridgeClientState();
        logWechatBridgeState(api, "start:client-ready", state);

        await connectBridgeClient(api, wsConfig, onInboundMessage);
        installBridgeHeartbeat(api, state);
        syncStateFromModuleRefs(state);
        logWechatBridgeState(api, "start:heartbeat-ready", state);
    };

    startState.startPromise = performStart().finally(() => {
        if (startState.startPromise) {
            startState.startPromise = null;
        }
    });

    await startState.startPromise;
}

export function triggerWechatBridgeStart(
    api: OpenClawPluginApi,
    onInboundMessage: WechatBridgeInboundHandler,
): void {
    void ensureWechatBridgeStarted(api, onInboundMessage).catch((err) => {
        handleBridgeStartFailure(api, err, onInboundMessage);
    });
}

export function maybeRecoverWechatBridgeOnDuplicateRegister(params: {
    api: OpenClawPluginApi;
    state: WechatBridgeGlobalState;
    triggerBridgeStart: (api: OpenClawPluginApi) => void;
}): void {
    const { api, state, triggerBridgeStart } = params;
    if (state.closing || state.startPromise || hasActiveWechatBridgeClient(state)) {
        return;
    }

    const now = Date.now();
    const shouldAttemptRecovery =
        !state.lastRecoveryAttemptAt ||
        now - state.lastRecoveryAttemptAt >= DUPLICATE_REGISTER_RECOVERY_COOLDOWN_MS;
    if (!shouldAttemptRecovery) {
        return;
    }

    state.lastRecoveryAttemptAt = now;
    if (
        !state.lastRecoveryLogAt ||
        now - state.lastRecoveryLogAt >= DUPLICATE_REGISTER_RECOVERY_LOG_INTERVAL_MS
    ) {
        state.lastRecoveryLogAt = now;
        api.logger.info(
            "[WeChat] Duplicate register detected while bridge is offline; attempting recovery.",
        );
    }
    triggerBridgeStart(api);
}
