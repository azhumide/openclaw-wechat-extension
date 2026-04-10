import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type { WebSocket, WebSocketServer } from "ws";

const globalSym = Symbol.for("openclaw.wechat.bridge.state");

interface WeChatBridgeState {
    runtime: PluginRuntime | null;
    wsServer: WebSocketServer | null;
    activeSocket: WebSocket | null;
    lastPongAt: number;
    httpServer?: unknown;
    heartbeatTimer?: unknown;
    closing?: boolean;
    startPromise?: Promise<void> | null;
    registering?: boolean;
    registered?: boolean;
    duplicateRegisterCount?: number;
    lastDuplicateRegisterLogAt?: number;
    lastRecoveryAttemptAt?: number;
    lastRecoveryLogAt?: number;
    pendingToolAuthBySession: Map<string, WechatToolAuthRecord[]>;
    dispatchToolAuthBySession: Map<string, WechatToolAuthRecord[]>;
    activeToolAuthBySession: Map<string, WechatToolAuthRecord>;
    toolAuthByRunId: Map<string, WechatToolAuthRecord>;
    latestToolAuthByChat: Map<string, WechatToolAuthRecord>;
    blockedReplyBySession: Map<string, WechatBlockedReplyRecord>;
    skillToolSessions: Map<string, WechatSkillToolSessionRecord>;
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

export type WechatSkillToolSessionRecord = {
    sessionId: string;
    skillId?: string;
    sessionKey?: string;
    createdAt: number;
};

export type WechatBlockedReplyRecord = {
    sessionKey: string;
    toolName?: string;
    reason?: string;
    noticeSent?: boolean;
    createdAt: number;
};

const getGlobalState = (): WeChatBridgeState => {
    const holder = globalThis as any;
    const state = (holder[globalSym] ??= {});
    if (!("runtime" in state)) state.runtime = null;
    if (!("wsServer" in state)) state.wsServer = null;
    if (!("activeSocket" in state)) state.activeSocket = null;
    if (!("lastPongAt" in state)) state.lastPongAt = 0;
    if (!("httpServer" in state)) state.httpServer = null;
    if (!("heartbeatTimer" in state)) state.heartbeatTimer = null;
    if (!("closing" in state)) state.closing = false;
    if (!("startPromise" in state)) state.startPromise = null;
    if (!("registering" in state)) state.registering = false;
    if (!("registered" in state)) state.registered = false;
    if (!("duplicateRegisterCount" in state)) state.duplicateRegisterCount = 0;
    if (!("lastDuplicateRegisterLogAt" in state)) state.lastDuplicateRegisterLogAt = 0;
    if (!("lastRecoveryAttemptAt" in state)) state.lastRecoveryAttemptAt = 0;
    if (!("lastRecoveryLogAt" in state)) state.lastRecoveryLogAt = 0;
    if (!(state.pendingToolAuthBySession instanceof Map)) {
        state.pendingToolAuthBySession = new Map<string, WechatToolAuthRecord[]>();
    }
    if (!(state.dispatchToolAuthBySession instanceof Map)) {
        state.dispatchToolAuthBySession = new Map<string, WechatToolAuthRecord[]>();
    }
    if (!(state.activeToolAuthBySession instanceof Map)) {
        state.activeToolAuthBySession = new Map<string, WechatToolAuthRecord>();
    }
    if (!(state.toolAuthByRunId instanceof Map)) {
        state.toolAuthByRunId = new Map<string, WechatToolAuthRecord>();
    }
    if (!(state.latestToolAuthByChat instanceof Map)) {
        state.latestToolAuthByChat = new Map<string, WechatToolAuthRecord>();
    }
    if (!(state.blockedReplyBySession instanceof Map)) {
        state.blockedReplyBySession = new Map<string, WechatBlockedReplyRecord>();
    }
    if (!(state.skillToolSessions instanceof Map)) {
        state.skillToolSessions = new Map<string, WechatSkillToolSessionRecord>();
    }
    return state;
};

const TOOL_AUTH_MAX_AGE_MS = 5 * 60 * 1000;
const TOOL_AUTH_MAX_QUEUE = 50;
const SKILL_TOOL_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function normalizeWechatTextForMatch(value: string | undefined): string {
    return (value || "").replace(/\r\n/g, "\n").trim();
}

function trimQueue(queue: WechatToolAuthRecord[]) {
    if (queue.length > TOOL_AUTH_MAX_QUEUE) {
        queue.splice(0, queue.length - TOOL_AUTH_MAX_QUEUE);
    }
}

function getChatKeyFromSessionKey(sessionKey: string | undefined): string | undefined {
    const trimmed = sessionKey?.trim();
    if (!trimmed) {
        return undefined;
    }

    const marker = ":wechat:";
    const markerIndex = trimmed.indexOf(marker);
    if (markerIndex < 0) {
        return undefined;
    }

    const suffix = trimmed.slice(markerIndex + marker.length);
    const separatorIndex = suffix.indexOf(":");
    if (separatorIndex <= 0) {
        return undefined;
    }

    const from = suffix.slice(separatorIndex + 1).trim();
    return from || undefined;
}

function cleanExpiredToolAuth(now = Date.now()) {
    const state = getGlobalState();
    const isFresh = (entry: WechatToolAuthRecord) => now - entry.createdAt <= TOOL_AUTH_MAX_AGE_MS;
    const isFreshBlockedReply = (entry: WechatBlockedReplyRecord) => now - entry.createdAt <= TOOL_AUTH_MAX_AGE_MS;

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

    for (const [chatKey, entry] of state.latestToolAuthByChat) {
        if (!isFresh(entry)) {
            state.latestToolAuthByChat.delete(chatKey);
        }
    }

    for (const [sessionKey, entry] of state.activeToolAuthBySession) {
        if (!isFresh(entry)) {
            state.activeToolAuthBySession.delete(sessionKey);
        }
    }

    for (const [sessionKey, entry] of state.blockedReplyBySession) {
        if (!isFreshBlockedReply(entry)) {
            state.blockedReplyBySession.delete(sessionKey);
        }
    }

    for (const [sessionId, entry] of state.skillToolSessions) {
        if (now - entry.createdAt > SKILL_TOOL_SESSION_MAX_AGE_MS) {
            state.skillToolSessions.delete(sessionId);
        }
    }
}

export function enqueueWechatInboundToolAuth(entry: WechatToolAuthRecord) {
    cleanExpiredToolAuth(entry.createdAt);
    const state = getGlobalState();
    state.blockedReplyBySession.delete(entry.sessionKey);
    const queue = state.pendingToolAuthBySession.get(entry.sessionKey) ?? [];
    queue.push(entry);
    trimQueue(queue);
    state.pendingToolAuthBySession.set(entry.sessionKey, queue);

    const chatKey = entry.from?.trim() || getChatKeyFromSessionKey(entry.sessionKey);
    if (chatKey) {
        state.latestToolAuthByChat.set(chatKey, entry);
    }

    // Keep the latest inbound auth snapshot at session scope as a conservative fallback.
    // The run-bound auth remains the source of truth; this session-level snapshot is used
    // when dispatch/run binding is skipped during session reuse or reconnect races.
    state.activeToolAuthBySession.set(entry.sessionKey, entry);
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

export function getWechatToolAuthForSession(sessionKey: string): WechatToolAuthRecord | undefined {
    cleanExpiredToolAuth();
    const trimmed = sessionKey.trim();
    if (!trimmed) {
        return undefined;
    }
    const state = getGlobalState();
    return (
        state.activeToolAuthBySession.get(trimmed) ??
        state.dispatchToolAuthBySession.get(trimmed)?.at(-1) ??
        state.pendingToolAuthBySession.get(trimmed)?.at(-1)
    );
}

export function getWechatToolAuthFallbackForSession(sessionKey: string): WechatToolAuthRecord | undefined {
    cleanExpiredToolAuth();
    const chatKey = getChatKeyFromSessionKey(sessionKey);
    if (!chatKey) {
        return undefined;
    }
    return getGlobalState().latestToolAuthByChat.get(chatKey);
}

export function summarizeWechatToolAuthDebugState(params: {
    sessionKey?: string;
    runId?: string;
}): string {
    cleanExpiredToolAuth();
    const state = getGlobalState();
    const sessionKey = params.sessionKey?.trim();
    const runId = params.runId?.trim();
    const pendingQueue = sessionKey ? state.pendingToolAuthBySession.get(sessionKey) : undefined;
    const dispatchQueue = sessionKey ? state.dispatchToolAuthBySession.get(sessionKey) : undefined;
    const activeEntry = sessionKey ? state.activeToolAuthBySession.get(sessionKey) : undefined;
    const runEntry = runId ? state.toolAuthByRunId.get(runId) : undefined;

    const parts = [
        `sessionKey=${sessionKey || ""}`,
        `runId=${runId || ""}`,
        `pending=${pendingQueue?.length ?? 0}`,
        `dispatch=${dispatchQueue?.length ?? 0}`,
        `hasActive=${Boolean(activeEntry)}`,
        `hasRun=${Boolean(runEntry)}`,
    ];

    const activeIsMaster = activeEntry?.isMaster ?? runEntry?.isMaster;
    if (typeof activeIsMaster === "boolean") {
        parts.push(`isMaster=${activeIsMaster}`);
    }

    const activeSender = activeEntry?.senderId || runEntry?.senderId;
    if (activeSender) {
        parts.push(`senderId=${activeSender}`);
    }
    const pendingSender = pendingQueue?.[pendingQueue.length - 1]?.senderId;
    if (pendingSender) {
        parts.push(`pendingSender=${pendingSender}`);
    }
    const dispatchSender = dispatchQueue?.[dispatchQueue.length - 1]?.senderId;
    if (dispatchSender) {
        parts.push(`dispatchSender=${dispatchSender}`);
    }

    return parts.join(" ");
}

export function clearWechatToolAuthForRun(runId: string) {
    getGlobalState().toolAuthByRunId.delete(runId);
}

export function clearWechatToolAuthForSession(sessionKey: string) {
    const state = getGlobalState();
    state.pendingToolAuthBySession.delete(sessionKey);
    state.dispatchToolAuthBySession.delete(sessionKey);
    state.activeToolAuthBySession.delete(sessionKey);
    state.blockedReplyBySession.delete(sessionKey);
    for (const [runId, entry] of state.toolAuthByRunId) {
        if (entry.sessionKey === sessionKey) {
            state.toolAuthByRunId.delete(runId);
        }
    }
    // Keep the latest chat-level label/auth snapshot until TTL expiry.
    // Session keys are reused per chat, so session_end from an older turn can race
    // with a newer inbound message and wipe the fresh group name fallback.
    for (const [skillSessionId, entry] of state.skillToolSessions) {
        if (entry.sessionKey === sessionKey) {
            state.skillToolSessions.delete(skillSessionId);
        }
    }
}

export function markWechatBlockedReplyForSession(params: {
    sessionKey: string;
    toolName?: string;
    reason?: string;
    noticeSent?: boolean;
    createdAt?: number;
}) {
    const createdAt = params.createdAt ?? Date.now();
    cleanExpiredToolAuth(createdAt);
    getGlobalState().blockedReplyBySession.set(params.sessionKey, {
        sessionKey: params.sessionKey,
        toolName: params.toolName,
        reason: params.reason,
        noticeSent: params.noticeSent,
        createdAt,
    });
}

export function getWechatBlockedReplyForSession(sessionKey: string): WechatBlockedReplyRecord | undefined {
    cleanExpiredToolAuth();
    return getGlobalState().blockedReplyBySession.get(sessionKey);
}

export function rememberWechatSkillToolSession(params: {
    sessionId: string;
    skillId?: string;
    sessionKey?: string;
    createdAt?: number;
}) {
    const createdAt = params.createdAt ?? Date.now();
    cleanExpiredToolAuth(createdAt);
    getGlobalState().skillToolSessions.set(params.sessionId, {
        sessionId: params.sessionId,
        skillId: params.skillId,
        sessionKey: params.sessionKey,
        createdAt,
    });
}

export function getWechatSkillToolSession(sessionId: string): WechatSkillToolSessionRecord | undefined {
    cleanExpiredToolAuth();
    return getGlobalState().skillToolSessions.get(sessionId);
}

export function isWechatSkillToolSession(sessionId: string): boolean {
    return Boolean(getWechatSkillToolSession(sessionId));
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
    state.latestToolAuthByChat.clear();
    state.blockedReplyBySession.clear();
    state.skillToolSessions.clear();
}
