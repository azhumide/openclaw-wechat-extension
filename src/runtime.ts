import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type { WebSocket, WebSocketServer } from "ws";

const globalSym = Symbol.for("openclaw.wechat.bridge.state");

interface WeChatBridgeState {
    runtime: PluginRuntime | null;
    wsServer: WebSocketServer | null;
    activeSocket: WebSocket | null;
    lastPongAt: number;
}

const getGlobalState = (): WeChatBridgeState => {
    if (!(globalThis as any)[globalSym]) {
        (globalThis as any)[globalSym] = {
            runtime: null,
            wsServer: null,
            activeSocket: null,
            lastPongAt: 0,
        };
    }
    return (globalThis as any)[globalSym];
};

export function setWechatRuntime(next: PluginRuntime) {
    getGlobalState().runtime = next;
}

export function getWechatRuntime(): PluginRuntime {
    const r = getGlobalState().runtime;
    if (!r) {
        throw new Error("WeChat runtime not initialized");
    }
    return r;
}

export function setWechatWsServer(server: WebSocketServer | null) {
    getGlobalState().wsServer = server;
}

export function getWechatWsServer(): WebSocketServer | null {
    return getGlobalState().wsServer;
}

export function setActiveBridgeSocket(socket: WebSocket | null) {
    const s = getGlobalState();
    s.activeSocket = socket;
    if (socket) {
        s.lastPongAt = Date.now();
    }
}

export function getActiveBridgeSocket(): WebSocket | null {
    return getGlobalState().activeSocket;
}

export function markBridgePong() {
    getGlobalState().lastPongAt = Date.now();
}

export function getBridgeLastPongAt(): number {
    return getGlobalState().lastPongAt;
}

export function isBridgeConnected(): boolean {
    const s = getGlobalState().activeSocket;
    return Boolean(s && s.readyState === s.OPEN);
}

export function sendToBridge(frame: unknown): { ok: true } | { ok: false; error: string } {
    const socket = getActiveBridgeSocket();
    const state = getGlobalState();
    const logger = state.runtime?.logging.getChildLogger({ subsystem: "wechat-bridge" });

    if (!socket || socket.readyState !== 1 /* OPEN */) {
        const err = !socket ? "no active socket" : `socket state ${socket.readyState}`;
        if (logger) {
            logger.error(`[WeChat] Proactive send failed: ${err}`);
        }
        return { ok: false, error: `bridge ws disconnected (${err})` };
    }
    try {
        socket.send(JSON.stringify(frame));
        return { ok: true };
    } catch (err: any) {
        if (logger) {
            logger.error(`[WeChat] Proactive send exception: ${err?.message}`);
        }
        return { ok: false, error: err?.message || "bridge ws send failed" };
    }
}

export function clearBridgeRuntimeState() {
    const state = getGlobalState();
    state.wsServer = null;
    state.activeSocket = null;
    state.lastPongAt = 0;
}
