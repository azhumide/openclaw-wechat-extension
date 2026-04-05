import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type { WebSocket, WebSocketServer } from "ws";

const globalSym = Symbol.for("openclaw.wechat.bridge.state");

interface WeChatBridgeState {
    runtime: PluginRuntime | null;
    wsServer: WebSocketServer | null;
    activeSocket: WebSocket | null;
    lastPongAt: number;
    pendingToolAuthBySession: Map<string, WechatToolAuthRecord[]>;
    dispatchToolAuthBySession: Map<string, WechatToolAuthRecord[]>;
    activeToolAuthBySession: Map<string, WechatToolAuthRecord>;
    toolAuthByRunId: Map<string, WechatToolAuthRecord>;
}

export type WechatToolAuthRecord = {
    sessionKey: string;
    from?: string;
    accountId?: string;
    chatType?: "group" | "direct";
    conversationLabel?: string;
    senderId: string;
    senderName?: string;
    isMaster: boolean;
    content?: string;
    messageId?: string;
    createdAt: number;
};

const getGlobalState = (): WeChatBridgeState => {
    if (!(globalThis as any)[globalSym]) {
        (globalThis as any)[globalSym] = {
            runtime: null,
            wsServer: null,
            activeSocket: null,
            lastPongAt: 0,
            pendingToolAuthBySession: new Map<string, WechatToolAuthRecord[]>(),
            dispatchToolAuthBySession: new Map<string, WechatToolAuthRecord[]>(),
            activeToolAuthBySession: new Map<string, WechatToolAuthRecord>(),
            toolAuthByRunId: new Map<string, WechatToolAuthRecord>(),
        };
    }
    return (globalThis as any)[globalSym];
};

const TOOL_AUTH_MAX_AGE_MS = 5 * 60 * 1000;
const TOOL_AUTH_MAX_QUEUE = 50;

function normalizeWechatTextForMatch(value: string | undefined): string {
    return (value || "").replace(/\r\n/g, "\n").trim();
}

function trimQueue(queue: WechatToolAuthRecord[]) {
    if (queue.length > TOOL_AUTH_MAX_QUEUE) {
        queue.splice(0, queue.length - TOOL_AUTH_MAX_QUEUE);
    }
}

function cleanExpiredToolAuth(now = Date.now()) {
    const state = getGlobalState();
    const isFresh = (entry: WechatToolAuthRecord) => now - entry.createdAt <= TOOL_AUTH_MAX_AGE_MS;

    for (const [sessionKey, queue] of state.pendingToolAuthBySession) {
        const filtered = queue.filter(isFresh);
        if (filtered.length > 0) {
            state.pendingToolAuthBySession.set(sessionKey, filtered);
        } else {
            state.pendingToolAuthBySession.delete(sessionKey);
        }
    }

    for (const [sessionKey, queue] of state.dispatchToolAuthBySession) {
        const filtered = queue.filter(isFresh);
        if (filtered.length > 0) {
            state.dispatchToolAuthBySession.set(sessionKey, filtered);
        } else {
            state.dispatchToolAuthBySession.delete(sessionKey);
        }
    }

    for (const [runId, entry] of state.toolAuthByRunId) {
        if (!isFresh(entry)) {
            state.toolAuthByRunId.delete(runId);
        }
    }

    for (const [sessionKey, entry] of state.activeToolAuthBySession) {
        if (!isFresh(entry)) {
            state.activeToolAuthBySession.delete(sessionKey);
        }
    }
}

export function enqueueWechatInboundToolAuth(entry: WechatToolAuthRecord) {
    cleanExpiredToolAuth(entry.createdAt);
    const state = getGlobalState();
    const queue = state.pendingToolAuthBySession.get(entry.sessionKey) ?? [];
    queue.push(entry);
    trimQueue(queue);
    state.pendingToolAuthBySession.set(entry.sessionKey, queue);
}

export function promoteWechatToolAuthForDispatch(params: {
    sessionKey: string;
    senderId?: string;
    content?: string;
}): WechatToolAuthRecord | undefined {
    cleanExpiredToolAuth();
    const state = getGlobalState();
    const queue = state.pendingToolAuthBySession.get(params.sessionKey);
    if (!queue || queue.length === 0) {
        return undefined;
    }

    const normalizedContent = normalizeWechatTextForMatch(params.content);
    let index = queue.findIndex((entry) => {
        if (params.senderId && entry.senderId !== params.senderId) {
            return false;
        }
        return normalizeWechatTextForMatch(entry.content) === normalizedContent;
    });

    if (index < 0 && params.senderId) {
        index = queue.findIndex((entry) => entry.senderId === params.senderId);
    }

    if (index < 0) {
        index = 0;
    }

    const [entry] = queue.splice(index, 1);
    if (!entry) {
        return undefined;
    }

    if (queue.length > 0) {
        state.pendingToolAuthBySession.set(params.sessionKey, queue);
    } else {
        state.pendingToolAuthBySession.delete(params.sessionKey);
    }

    const dispatchQueue = state.dispatchToolAuthBySession.get(params.sessionKey) ?? [];
    dispatchQueue.push(entry);
    trimQueue(dispatchQueue);
    state.dispatchToolAuthBySession.set(params.sessionKey, dispatchQueue);
    return entry;
}

export function bindWechatToolAuthToRun(params: {
    sessionKey: string;
    runId: string;
}): WechatToolAuthRecord | undefined {
    cleanExpiredToolAuth();
    const state = getGlobalState();
    const queue = state.dispatchToolAuthBySession.get(params.sessionKey);
    if (!queue || queue.length === 0) {
        return undefined;
    }
    const entry = queue.shift();
    if (!entry) {
        return undefined;
    }
    if (queue.length > 0) {
        state.dispatchToolAuthBySession.set(params.sessionKey, queue);
    } else {
        state.dispatchToolAuthBySession.delete(params.sessionKey);
    }
    state.toolAuthByRunId.set(params.runId, entry);
    state.activeToolAuthBySession.set(params.sessionKey, entry);
    return entry;
}

export function inheritWechatToolAuthForChildSession(params: {
    requesterSessionKey: string;
    childSessionKey: string;
    createdAt?: number;
}): WechatToolAuthRecord | undefined {
    const createdAt = params.createdAt ?? Date.now();
    cleanExpiredToolAuth(createdAt);
    const state = getGlobalState();
    const source =
        state.activeToolAuthBySession.get(params.requesterSessionKey) ??
        state.dispatchToolAuthBySession.get(params.requesterSessionKey)?.at(-1) ??
        state.pendingToolAuthBySession.get(params.requesterSessionKey)?.at(-1);
    if (!source) {
        return undefined;
    }

    const inherited: WechatToolAuthRecord = {
        ...source,
        sessionKey: params.childSessionKey,
        createdAt,
    };
    const dispatchQueue = state.dispatchToolAuthBySession.get(params.childSessionKey) ?? [];
    dispatchQueue.push(inherited);
    trimQueue(dispatchQueue);
    state.dispatchToolAuthBySession.set(params.childSessionKey, dispatchQueue);
    state.activeToolAuthBySession.set(params.childSessionKey, inherited);
    return inherited;
}

export function getWechatToolAuthForRun(runId: string): WechatToolAuthRecord | undefined {
    cleanExpiredToolAuth();
    return getGlobalState().toolAuthByRunId.get(runId);
}

export function clearWechatToolAuthForRun(runId: string) {
    getGlobalState().toolAuthByRunId.delete(runId);
}

export function clearWechatToolAuthForSession(sessionKey: string) {
    const state = getGlobalState();
    state.pendingToolAuthBySession.delete(sessionKey);
    state.dispatchToolAuthBySession.delete(sessionKey);
    state.activeToolAuthBySession.delete(sessionKey);
    for (const [runId, entry] of state.toolAuthByRunId) {
        if (entry.sessionKey === sessionKey) {
            state.toolAuthByRunId.delete(runId);
        }
    }
}

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
    state.pendingToolAuthBySession.clear();
    state.dispatchToolAuthBySession.clear();
    state.activeToolAuthBySession.clear();
    state.toolAuthByRunId.clear();
}
