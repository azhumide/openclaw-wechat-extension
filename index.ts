import * as fs from "fs";
import * as path from "path";
import { Buffer } from "buffer";
import { createHash } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk/core";
import { wechatPlugin } from "./src/channel.js";
import { resolveWechatExtensionConfig } from "./src/config.js";
import { redactWechatUnknownText, redactWechatWxids } from "./src/redaction.js";
import {
    bindWechatToolAuthToRun,
    clearWechatToolAuthForRun,
    clearWechatToolAuthForSession,
    clearBridgeRuntimeState,
    enqueueWechatInboundToolAuth,
    getActiveBridgeSocket,
    getBridgeLastPongAt,
    getWechatBlockedReplyForSession,
    markBridgePong,
    getWechatSkillToolSession,
    getWechatToolAuthFallbackForSession,
    getWechatToolAuthForRun,
    getWechatToolAuthForSession,
    inheritWechatToolAuthForChildSession,
    markWechatBlockedReplyForSession,
    promoteWechatToolAuthForDispatch,
    rememberWechatSkillToolSession,
    setActiveBridgeSocket,
    summarizeWechatToolAuthDebugState,
    setWechatRuntime,
    setWechatWsServer,
} from "./src/runtime.js";

// 这里的全局变量仅用于当前模块实例引用
let bridgeWss: WebSocketServer | null = null;
let bridgeHeartbeatTimer: NodeJS.Timeout | null = null;
let bridgeClosePromise: Promise<void> | null = null;
let bridgeClientReconnectTimer: NodeJS.Timeout | null = null;

const globalSym = Symbol.for("openclaw.wechat.bridge.state");
const DUPLICATE_REGISTER_RECOVERY_COOLDOWN_MS = 5_000;
const DUPLICATE_REGISTER_RECOVERY_LOG_INTERVAL_MS = 30_000;
const WECHAT_TOOL_NOTICE_DEDUP_TTL_MS = 120_000;
const WECHAT_TOOL_AUTH_LOG_DEDUP_TTL_MS = 120_000;
const WECHAT_REPLY_MEDIA_DEDUP_TTL_MS = 15_000;
const WECHAT_MEDIA_DEDUP_SAMPLE_BYTES = 128 * 1024;

type WechatBridgeGlobalState = {
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
    recentToolNoticeAt: Map<string, number>;
    recentToolAuthLogAt: Map<string, number>;
    recentReplyMediaAt: Map<string, number>;
    clientConnecting?: boolean;
};

function getGlobalState(): WechatBridgeGlobalState {
    const holder = globalThis as Record<symbol, any>;
    const existing = (holder[globalSym] ??= {});
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
    if (!(existing.recentToolNoticeAt instanceof Map)) existing.recentToolNoticeAt = new Map<string, number>();
    if (!(existing.recentToolAuthLogAt instanceof Map)) existing.recentToolAuthLogAt = new Map<string, number>();
    if (!(existing.recentReplyMediaAt instanceof Map)) existing.recentReplyMediaAt = new Map<string, number>();
    if (!("clientConnecting" in existing)) existing.clientConnecting = false;
    return existing as WechatBridgeGlobalState;
}

function markWechatApiBound(api: OpenClawPluginApi): boolean {
    const state = getGlobalState();
    const apiRef = api as object;
    if (state.boundApis.has(apiRef)) {
        return false;
    }
    state.boundApis.add(apiRef);
    return true;
}

function syncModuleRefsFromState(state = getGlobalState()) {
    bridgeWss = state.wsServer;
    bridgeHeartbeatTimer = state.heartbeatTimer;
}

function syncStateFromModuleRefs(state = getGlobalState()) {
    state.wsServer = bridgeWss;
    state.heartbeatTimer = bridgeHeartbeatTimer;
}

function clearModuleRefs() {
    bridgeWss = null;
    bridgeHeartbeatTimer = null;
    if (bridgeClientReconnectTimer) {
        clearTimeout(bridgeClientReconnectTimer);
        bridgeClientReconnectTimer = null;
    }
}

function clearBridgeStateRefs(state = getGlobalState()) {
    clearModuleRefs();
    state.wsServer = null;
    state.heartbeatTimer = null;
    state.startPromise = null;
}

function formatBridgeStateSnapshot(state = getGlobalState()) {
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

function logBridgeState(api: OpenClawPluginApi | undefined, phase: string, state = getGlobalState()) {
    api?.logger.debug?.(`[WeChat] Bridge state (${phase}): ${formatBridgeStateSnapshot(state)}`);
}

function hasActiveBridgeClient(state = getGlobalState()): boolean {
    const activeSocket = getActiveBridgeSocket();
    return Boolean(
        state.clientConnecting ||
        (activeSocket && activeSocket.readyState === WebSocket.OPEN),
    );
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

function stripFalseWechatMediaFailureSuffix(text: string): {
    text: string;
    stripped: boolean;
} {
    const strippedText = text.replace(/\s*\n?⚠️ Media failed\.\s*$/u, "").trimEnd();
    return {
        text: strippedText,
        stripped: strippedText !== text,
    };
}

/**
 * 智能合并两个可能重叠的字符串。常用于处理 LLM 重复输出前缀的情况。
 */
function mergeOverlappingStrings(current: string, next: string): string {
    if (!next) return current;
    if (!current) return next;
    
    // 1. 完全包含检查
    if (next.startsWith(current)) return next;
    if (current.includes(next)) return current;

    // 清理空白字符以进行模糊匹配（防止模型输出过程中更改了 \n 为 \n\n 导致重叠算法失效）
    const normC = current.replace(/\s+/g, '');
    const normN = next.replace(/\s+/g, '');

    // 2. 模糊累计检查 (如果 next 实际上只是 current 的累积拓展)
    if (normN.startsWith(normC)) {
        return next;
    }
    
    // 3. 模糊结尾/开头重叠检查
    const maxPossibleOverlap = Math.min(normC.length, normN.length);
    const minOverlap = Math.min(maxPossibleOverlap, 4); 
    
    for (let len = maxPossibleOverlap; len >= minOverlap; len--) {
        const prefixNormN = normN.slice(0, len);
        if (normC.endsWith(prefixNormN)) {
            // 找到了无视空白的重叠！
            // 现在我们要截取 next 中不需要的部分。我们需要跳过 len 个非空白字符
            let charsToSkip = len;
            let cutIndex = 0;
            while (charsToSkip > 0 && cutIndex < next.length) {
                if (!/\s/.test(next[cutIndex])) {
                    charsToSkip--;
                }
                cutIndex++;
            }
            
            // 将 current 加上 next 去掉重叠部分的内容
            const separator = (current.endsWith('\n') || next.slice(cutIndex).startsWith('\n')) ? "" : " ";
            return current + separator + next.slice(cutIndex).trimStart();
        }
    }
    
    // 4. 无重叠，正常相加
    const separator = (current.endsWith('\n') || next.startsWith('\n')) ? "" : "\n";
    return current + separator + next;
}

type WechatReplyCollapseResult = {
    text: string;
    mode: "none" | "exact-repeat" | "dominant-repeat";
    originalLength: number;
    collapsedLength: number;
    repeatCount?: number;
    unitLength?: number;
    leftoverLength?: number;
};

function collapseRepeatedReplyText(text: string): WechatReplyCollapseResult {
    const normalized = text.replace(/\r\n/g, "\n").trim();
    if (normalized.length < 40) {
        return {
            text: normalized,
            mode: "none",
            originalLength: normalized.length,
            collapsedLength: normalized.length,
        };
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
            const collapsed = unit.trim();
            return {
                text: collapsed,
                mode: "exact-repeat",
                originalLength: normalized.length,
                collapsedLength: collapsed.length,
                repeatCount,
                unitLength,
                leftoverLength: 0,
            };
        }
    }

    const MIN_DOMINANT_BLOCK_LENGTH = 80;
    const compactNormalized = normalized.replace(/\s+/g, "");
    for (
        let unitLength = Math.floor(normalized.length / 2);
        unitLength >= MIN_DOMINANT_BLOCK_LENGTH;
        unitLength--
    ) {
        const unit = normalized.slice(0, unitLength).trim();
        if (unit.length < MIN_DOMINANT_BLOCK_LENGTH) {
            continue;
        }

        let count = 0;
        let searchIndex = 0;
        let lastConsumedIndex = 0;
        let leftover = "";

        while (searchIndex < normalized.length) {
            const foundIndex = normalized.indexOf(unit, searchIndex);
            if (foundIndex < 0) {
                break;
            }
            leftover += normalized.slice(lastConsumedIndex, foundIndex);
            count += 1;
            searchIndex = foundIndex + unit.length;
            lastConsumedIndex = searchIndex;
        }
        leftover += normalized.slice(lastConsumedIndex);

        if (count < 2) {
            continue;
        }

        const compactLeftover = leftover.replace(/\s+/g, "");
        const compactUnit = unit.replace(/\s+/g, "");
        const leftoverLimit = Math.max(
            8,
            Math.min(24, Math.floor(compactUnit.length * 0.08)),
        );

        if (
            compactLeftover.length <= leftoverLimit &&
            compactUnit.length * count >= compactNormalized.length - leftoverLimit
        ) {
            return {
                text: unit,
                mode: "dominant-repeat",
                originalLength: normalized.length,
                collapsedLength: unit.length,
                repeatCount: count,
                unitLength,
                leftoverLength: compactLeftover.length,
            };
        }
    }

    return {
        text: normalized,
        mode: "none",
        originalLength: normalized.length,
        collapsedLength: normalized.length,
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

function redactWechatTextForLogs(
    text: string,
    config?: ReturnType<typeof resolveWechatExtensionConfig>,
): string {
    return redactWechatWxids(text, {
        enabled: config?.redactWxidsInLogs !== false,
        exactMatches: config?.redactExtraWxids,
    });
}

function redactWechatPayloadForLogs(
    value: unknown,
    config?: ReturnType<typeof resolveWechatExtensionConfig>,
): unknown {
    return redactWechatUnknownText(value, {
        enabled: config?.redactWxidsInLogs !== false,
        exactMatches: config?.redactExtraWxids,
    });
}

function rewriteWechatNonOwnerAddressing(text: string, params: {
    isMaster: boolean;
    senderName?: string;
}): string {
    if (params.isMaster || typeof text !== "string" || !text.trim()) {
        return text;
    }

    const fallbackName = "这位朋友";
    const rawName = (params.senderName || "").trim();
    const safeName =
        rawName &&
        rawName !== "User" &&
        !/^wxid_/i.test(rawName) &&
        !rawName.endsWith("@chatroom")
            ? rawName
            : fallbackName;

    let rewritten = text;
    rewritten = rewritten.replace(
        /^\s*(?:Boss|boss|BOSS|主人|老板|老大)\s*([,，:：、-]\s*)?/,
        `${safeName}，`,
    );
    rewritten = rewritten.replace(
        /只有\s*(?:Boss|boss|BOSS|主人|老板|老大)(?:（[^）]*）)?/g,
        "只有主人",
    );
    rewritten = rewritten.replace(
        /请由\s*(?:Boss|boss|BOSS|主人|老板|老大)(?:（[^）]*）)?/g,
        "请由主人",
    );
    rewritten = rewritten.replace(
        /(?:Boss|boss|BOSS|主人|老板|老大)(?:（[^）]*）)?\s*才能/g,
        "主人才能",
    );
    return rewritten;
}

function resolveWechatBareLocalMediaPath(params: {
    rawLine: string;
    workspaceBase?: string;
}): string | null {
    let candidate = params.rawLine.trim();
    if (!candidate || /^(?:MEDIA|FILE):/i.test(candidate) || /^https?:\/\//i.test(candidate)) {
        return null;
    }

    if (
        (candidate.startsWith("`") && candidate.endsWith("`")) ||
        (candidate.startsWith("\"") && candidate.endsWith("\"")) ||
        (candidate.startsWith("'") && candidate.endsWith("'"))
    ) {
        candidate = candidate.slice(1, -1).trim();
    }

    if (!candidate || /\s/.test(candidate)) {
        return null;
    }

    const looksAbsoluteUnix = candidate.startsWith("/");
    const looksAbsoluteWindows = /^[a-zA-Z]:[\\/]/.test(candidate);
    const looksRelative = candidate.startsWith("./") || candidate.startsWith("../");
    const looksHomeRelative = candidate.startsWith("~/") || candidate.startsWith("~\\");
    const looksBareFilename = /^[^\\/]+\.[A-Za-z0-9]{1,16}$/.test(candidate);

    if (!looksAbsoluteUnix && !looksAbsoluteWindows && !looksRelative && !looksHomeRelative && !looksBareFilename) {
        return null;
    }

    const baseDir = params.workspaceBase?.trim() || process.cwd();
    const expandedHome = looksHomeRelative
        ? path.join(process.env.HOME || process.env.USERPROFILE || "", candidate.slice(2))
        : candidate;
    const resolvedPath = looksAbsoluteUnix || looksAbsoluteWindows
        ? path.resolve(expandedHome)
        : path.resolve(baseDir, expandedHome);

    try {
        if (!fs.existsSync(resolvedPath)) {
            return null;
        }
        const stat = fs.statSync(resolvedPath);
        return stat.isFile() ? resolvedPath : null;
    } catch {
        return null;
    }
}

function extractWechatBareLocalMediaFromText(params: {
    text: string;
    workspaceBase?: string;
}): {
    text: string;
    mediaPaths: string[];
} {
    if (!params.text.trim()) {
        return {
            text: params.text,
            mediaPaths: [],
        };
    }

    const lines = params.text.split(/\r?\n/);
    const remainingLines: string[] = [];
    const mediaPaths: string[] = [];

    for (const line of lines) {
        const resolvedPath = resolveWechatBareLocalMediaPath({
            rawLine: line,
            workspaceBase: params.workspaceBase,
        });
        if (resolvedPath) {
            mediaPaths.push(resolvedPath);
            continue;
        }
        remainingLines.push(line);
    }

    return {
        text: remainingLines.join("\n").trim(),
        mediaPaths,
    };
}

function isWechatLocalMediaReference(value: unknown): value is string {
    if (typeof value !== "string") {
        return false;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return false;
    }
    return !/^https?:\/\//i.test(trimmed);
}

const WECHAT_SAFE_LOCAL_ATTACHMENT_EXTENSIONS = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".bmp",
    ".svg",
    ".mp4",
    ".mov",
    ".avi",
    ".webm",
    ".mkv",
    ".mp3",
    ".wav",
    ".ogg",
    ".m4a",
    ".aac",
    ".flac",
    ".amr",
    ".opus",
]);

function isWechatSafeLocalAttachmentPath(filePath: string): boolean {
    return WECHAT_SAFE_LOCAL_ATTACHMENT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

type WechatMediaCandidate = {
    mediaUrl: string;
    dedupKey: string;
};

function buildWechatLocalMediaDedupKey(filePath: string, logger?: OpenClawPluginApi["logger"]): string {
    const absolutePath = path.resolve(filePath.trim());

    try {
        const stat = fs.statSync(absolutePath);
        const hash = createHash("sha1");
        hash.update(`size:${stat.size};`);

        const fd = fs.openSync(absolutePath, "r");
        try {
            const sampleBytes = Math.min(Number(stat.size), WECHAT_MEDIA_DEDUP_SAMPLE_BYTES);
            if (sampleBytes > 0) {
                const headBuffer = Buffer.alloc(sampleBytes);
                const headRead = fs.readSync(fd, headBuffer, 0, sampleBytes, 0);
                hash.update(headBuffer.subarray(0, headRead));

                if (stat.size > sampleBytes) {
                    const tailBytes = Math.min(Number(stat.size) - sampleBytes, WECHAT_MEDIA_DEDUP_SAMPLE_BYTES);
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
    } catch (err: any) {
        logger?.warning?.(
            `[WeChat] Failed to fingerprint local media for dedup; fallback to path key raw=${filePath} resolved=${absolutePath} err=${err?.message || err}`,
        );
        return `local-path:${absolutePath}`;
    }
}

function buildWechatMediaDedupKey(params: {
    mediaUrl: string;
    logger?: OpenClawPluginApi["logger"];
}): string {
    const trimmed = params.mediaUrl.trim();
    if (!isWechatLocalMediaReference(trimmed)) {
        return `remote:${trimmed}`;
    }
    return buildWechatLocalMediaDedupKey(trimmed, params.logger);
}

function shouldBlockWechatLocalAttachmentDelivery(params: {
    mediaUrl: string;
    authContext: {
        senderId?: string;
        from?: string;
        isMaster?: boolean;
    };
    config: ReturnType<typeof resolveWechatExtensionConfig>;
}): {
    blocked: boolean;
    absolutePath?: string;
    reason?: string;
} {
    if (!isWechatLocalMediaReference(params.mediaUrl)) {
        return { blocked: false };
    }

    const absolutePath = path.resolve(params.mediaUrl.trim());
    if (params.authContext.isMaster) {
        return { blocked: false, absolutePath };
    }

    const bypassMatch = resolveWechatToolBypassMatch(
        normalizeWechatIdAllowList(params.config.toolAuthBypassWxids),
        params.authContext,
    );
    if (bypassMatch.matched) {
        return { blocked: false, absolutePath };
    }

    if (isWechatSafeLocalAttachmentPath(absolutePath)) {
        return { blocked: false, absolutePath };
    }

    return {
        blocked: true,
        absolutePath,
        reason: "non-owner-local-file",
    };
}

function filterWechatExistingMediaCandidates(params: {
    mediaUrls: string[];
    logger?: OpenClawPluginApi["logger"];
    resolveDedupKey?: (mediaUrl: string) => string;
}): WechatMediaCandidate[] {
    const filtered: WechatMediaCandidate[] = [];
    const seenDedupKeys = new Set<string>();

    for (const mediaUrl of params.mediaUrls) {
        const trimmed = mediaUrl.trim();
        if (!trimmed) {
            continue;
        }
        if (!isWechatLocalMediaReference(trimmed)) {
            const dedupKey = params.resolveDedupKey
                ? params.resolveDedupKey(trimmed)
                : buildWechatMediaDedupKey({ mediaUrl: trimmed, logger: params.logger });
            if (seenDedupKeys.has(dedupKey)) {
                continue;
            }
            seenDedupKeys.add(dedupKey);
            filtered.push({ mediaUrl: trimmed, dedupKey });
            continue;
        }
        const absolutePath = path.resolve(trimmed);
        if (!fs.existsSync(absolutePath)) {
            params.logger?.warning?.(
                `[WeChat] Skipping missing local media candidate before outbound send: raw=${trimmed} resolved=${absolutePath}`,
            );
            continue;
        }
        const dedupKey = params.resolveDedupKey
            ? params.resolveDedupKey(trimmed)
            : buildWechatMediaDedupKey({ mediaUrl: trimmed, logger: params.logger });
        if (seenDedupKeys.has(dedupKey)) {
            params.logger?.info?.(
                `[WeChat] Deduped equivalent local media candidate before outbound send: raw=${trimmed} key=${dedupKey}`,
            );
            continue;
        }
        seenDedupKeys.add(dedupKey);
        filtered.push({ mediaUrl: trimmed, dedupKey });
    }

    return filtered;
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

function normalizeWechatSkillIdList(value: string[] | undefined): Set<string> {
    return new Set(
        (value || [])
            .map((entry) => entry.trim().toLowerCase())
            .filter(Boolean),
    );
}

function buildWechatBlockedSkillIntentAliases(skillId: string): string[] {
    const normalized = skillId.trim().toLowerCase();
    if (!normalized) {
        return [];
    }

    const aliases = new Set<string>();
    const base = normalized.replace(/-skill$/i, "");
    const tokens = base.split(/[-_]+/).map((entry) => entry.trim()).filter(Boolean);

    aliases.add(normalized);
    aliases.add(base);
    aliases.add(base.replace(/[-_]+/g, ""));
    aliases.add(base.replace(/[-_]+/g, " "));

    for (const token of tokens) {
        if (token === "skill" || token === "helper" || token === "tools" || token === "tool" || token === "agent") {
            continue;
        }
        if (token.length >= 3 || /^\d{3,}$/.test(token)) {
            aliases.add(token);
        }
    }

    return [...aliases].filter(Boolean);
}

function matchWechatBlockedSkillIntent(text: string | undefined, blockedSkills: Set<string>): {
    matched: boolean;
    skillId?: string;
    alias?: string;
} {
    const normalizedText = (text || "").trim().toLowerCase();
    if (!normalizedText || blockedSkills.size === 0) {
        return { matched: false };
    }

    const compactText = normalizedText.replace(/\s+/g, "");
    const hasSkillishContext = /插件|skill|脚本|账号|状态|进度|补跑|运行|查询|查看|看看|多少/u.test(normalizedText);

    for (const skillId of blockedSkills) {
        const aliases = buildWechatBlockedSkillIntentAliases(skillId);
        for (const alias of aliases) {
            const trimmedAlias = alias.trim();
            if (!trimmedAlias) {
                continue;
            }

            const aliasCompact = trimmedAlias.replace(/\s+/g, "");
            const containsAlias = normalizedText.includes(trimmedAlias) || compactText.includes(aliasCompact);
            if (!containsAlias) {
                continue;
            }

            const isNumericAlias = /^\d{3,}$/.test(trimmedAlias);
            if (isNumericAlias && !hasSkillishContext) {
                continue;
            }

            return {
                matched: true,
                skillId,
                alias: trimmedAlias,
            };
        }
    }

    return { matched: false };
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

const WECHAT_SKILL_SCRIPT_EXTENSIONS = new Set([
    ".py",
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".sh",
    ".ps1",
    ".bat",
    ".cmd",
]);
const WECHAT_SKILL_LOCAL_EXECUTABLES = new Set([
    "python",
    "python3",
    "python3.10",
    "python3.11",
    "python3.12",
    "node",
    "pip",
    "pip3",
    "uv",
    "npm",
    "pnpm",
    "yarn",
]);
const WECHAT_SHELL_WRAPPER_EXECUTABLES = new Set([
    "ash",
    "bash",
    "cmd",
    "dash",
    "fish",
    "ksh",
    "powershell",
    "pwsh",
    "sh",
    "zsh",
]);
const WECHAT_SKILL_MARKER_VALUES = new Set([
    "---CMD---",
    "\\n---CMD---\\n",
    "\n---CMD---\n",
]);

let wechatInstalledSkillCache:
    | { key: string; expiresAt: number; roots: string[]; skillIds: Set<string> }
    | null = null;

function getWechatSkillRootCandidates(config: ReturnType<typeof resolveWechatExtensionConfig>): string[] {
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    const workspaceBase = config.workspaceBase ? path.resolve(config.workspaceBase) : "";
    const workspaceParent = workspaceBase ? path.dirname(workspaceBase) : "";
    const extensionParents = [
        path.join(process.cwd(), ".openclaw", "extensions"),
        path.join(process.cwd(), "extensions"),
        path.join(process.cwd(), "openclaw", "extensions"),
        workspaceBase ? path.join(workspaceBase, "extensions") : "",
        workspaceParent ? path.join(workspaceParent, "extensions") : "",
    ]
        .map((entry) => entry && path.resolve(entry))
        .filter(Boolean);
    const candidates = [
        path.join(process.cwd(), ".openclaw", "skills"),
        path.join(process.cwd(), "skills"),
        path.join(process.cwd(), "openclaw", "skills"),
        path.join(process.cwd(), ".agents", "skills"),
        homeDir ? path.join(homeDir, ".openclaw", "skills") : "",
        homeDir ? path.join(homeDir, ".agents", "skills") : "",
        workspaceBase ? path.join(workspaceBase, "skills") : "",
        workspaceBase ? path.join(workspaceBase, ".agents", "skills") : "",
        workspaceParent ? path.join(workspaceParent, "skills") : "",
        workspaceParent ? path.join(workspaceParent, ".agents", "skills") : "",
        ...extensionParents.flatMap((parentDir) => {
            try {
                return fs.readdirSync(parentDir, { withFileTypes: true })
                    .filter((entry) => entry.isDirectory())
                    .map((entry) => path.join(parentDir, entry.name, "skills"));
            } catch {
                return [];
            }
        }),
    ]
        .map((entry) => entry && path.resolve(entry))
        .filter(Boolean);

    return [...new Set(candidates)];
}

function resolveWechatInstalledSkillsSnapshot(config: ReturnType<typeof resolveWechatExtensionConfig>): {
    roots: string[];
    skillIds: Set<string>;
} {
    const roots = getWechatSkillRootCandidates(config).filter((root) => fs.existsSync(root));
    const cacheKey = roots.join("|");
    const now = Date.now();
    if (wechatInstalledSkillCache && wechatInstalledSkillCache.key === cacheKey && wechatInstalledSkillCache.expiresAt > now) {
        return {
            roots: wechatInstalledSkillCache.roots,
            skillIds: new Set(wechatInstalledSkillCache.skillIds),
        };
    }

    const skillIds = new Set<string>();
    for (const root of roots) {
        try {
            for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
                if (!entry.isDirectory()) {
                    continue;
                }
                const skillMdPath = path.join(root, entry.name, "SKILL.md");
                if (fs.existsSync(skillMdPath)) {
                    skillIds.add(entry.name.trim().toLowerCase());
                }
            }
        } catch {
            continue;
        }
    }

    wechatInstalledSkillCache = {
        key: cacheKey,
        expiresAt: now + 30_000,
        roots,
        skillIds,
    };
    return {
        roots,
        skillIds,
    };
}

function splitWechatShellTokens(command: string): string[] {
    const tokens = command.match(/"([^"\\]|\\.)*"|'[^']*'|\S+/g);
    return tokens ? tokens.map((token) => token.trim()).filter(Boolean) : [];
}

function unquoteWechatShellToken(token: string): string {
    const trimmed = token.trim();
    if (
        (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

function splitWechatShellSegments(command: string): string[] {
    const segments: string[] = [];
    let current = "";
    let inSingle = false;
    let inDouble = false;
    let escaped = false;

    const pushCurrent = () => {
        const trimmed = current.trim();
        if (trimmed) {
            segments.push(trimmed);
        }
        current = "";
    };

    for (let index = 0; index < command.length; index += 1) {
        const ch = command[index];
        const next = command[index + 1];

        if (escaped) {
            current += ch;
            escaped = false;
            continue;
        }

        if (!inSingle && ch === "\\") {
            current += ch;
            escaped = true;
            continue;
        }

        if (ch === "'" && !inDouble) {
            inSingle = !inSingle;
            current += ch;
            continue;
        }
        if (ch === "\"" && !inSingle) {
            inDouble = !inDouble;
            current += ch;
            continue;
        }

        if (!inSingle && !inDouble) {
            if ((ch === "&" && next === "&") || (ch === "|" && next === "|")) {
                pushCurrent();
                index += 1;
                continue;
            }
            if (ch === ";" || ch === "\n" || ch === "\r") {
                pushCurrent();
                continue;
            }
        }

        current += ch;
    }

    pushCurrent();
    return segments;
}

function normalizeWechatExecutableBase(token: string): string {
    const normalized = path.basename(unquoteWechatShellToken(token)).trim().toLowerCase();
    if (normalized.endsWith(".exe")) {
        return normalized.slice(0, -4);
    }
    return normalized;
}

function isWechatEnvAssignmentToken(token: string): boolean {
    return /^[A-Za-z_][A-Za-z0-9_]*=.*/.test(unquoteWechatShellToken(token).trim());
}

function stripWechatEnvWrapper(params: {
    tokens: string[];
    workdir?: string;
}): {
    changed: boolean;
    tokens: string[];
    workdir?: string;
    wrapper?: string;
} {
    if (params.tokens.length === 0 || normalizeWechatExecutableBase(params.tokens[0]) !== "env") {
        return {
            changed: false,
            tokens: params.tokens,
            workdir: params.workdir,
        };
    }

    let index = 1;
    let nextWorkdir = params.workdir;
    while (index < params.tokens.length) {
        const raw = unquoteWechatShellToken(params.tokens[index]).trim();
        const lower = raw.toLowerCase();
        if (!raw) {
            index += 1;
            continue;
        }
        if (raw === "--") {
            index += 1;
            break;
        }
        if (isWechatEnvAssignmentToken(params.tokens[index])) {
            index += 1;
            continue;
        }
        if (lower === "-i" || lower === "--ignore-environment" || lower === "-0" || lower === "--null") {
            index += 1;
            continue;
        }
        if (lower === "-u" || lower === "--unset") {
            index += 2;
            continue;
        }
        if (lower === "-c" || lower === "--chdir") {
            const target = index + 1 < params.tokens.length
                ? resolveWechatCommandPathCandidate(params.tokens[index + 1], params.workdir)
                : null;
            if (target) {
                nextWorkdir = target;
            }
            index += 2;
            continue;
        }
        if (raw.startsWith("-")) {
            return {
                changed: false,
                tokens: params.tokens,
                workdir: params.workdir,
            };
        }
        break;
    }

    if (index >= params.tokens.length) {
        return {
            changed: false,
            tokens: params.tokens,
            workdir: params.workdir,
        };
    }

    return {
        changed: true,
        tokens: params.tokens.slice(index),
        workdir: nextWorkdir,
        wrapper: "env",
    };
}

function extractWechatShellInlineCommand(params: {
    tokens: string[];
    workdir?: string;
}): {
    changed: boolean;
    command?: string;
    workdir?: string;
    wrapper?: string;
} {
    if (params.tokens.length < 2) {
        return { changed: false, workdir: params.workdir };
    }

    const execBase = normalizeWechatExecutableBase(params.tokens[0]);
    if (!WECHAT_SHELL_WRAPPER_EXECUTABLES.has(execBase)) {
        return { changed: false, workdir: params.workdir };
    }

    const readCommandAt = (index: number) => {
        if (index + 1 >= params.tokens.length) {
            return { changed: false, workdir: params.workdir };
        }
        const innerCommand = unquoteWechatShellToken(params.tokens[index + 1]).trim();
        if (!innerCommand) {
            return { changed: false, workdir: params.workdir };
        }
        return {
            changed: true,
            command: innerCommand,
            workdir: params.workdir,
            wrapper: execBase,
        };
    };

    for (let index = 1; index < params.tokens.length; index += 1) {
        const raw = unquoteWechatShellToken(params.tokens[index]).trim();
        const lower = raw.toLowerCase();
        if (!raw) {
            continue;
        }

        if (execBase === "cmd" && lower === "/c") {
            return readCommandAt(index);
        }
        if ((execBase === "powershell" || execBase === "pwsh") && (lower === "-c" || lower === "-command")) {
            return readCommandAt(index);
        }
        if (execBase !== "cmd" && execBase !== "powershell" && execBase !== "pwsh") {
            if (lower === "-c" || /^-[a-z]*c[a-z]*$/i.test(lower)) {
                return readCommandAt(index);
            }
        }
    }

    return { changed: false, workdir: params.workdir };
}

function unwrapWechatInstalledSkillCommand(command: string, workdir: string | undefined): {
    command: string;
    workdir?: string;
    wrappers: string[];
} {
    let currentCommand = command.trim();
    let currentWorkdir = workdir;
    const wrappers: string[] = [];

    for (let depth = 0; depth < 4; depth += 1) {
        const tokens = splitWechatShellTokens(currentCommand);
        if (tokens.length === 0) {
            break;
        }

        const envUnwrap = stripWechatEnvWrapper({
            tokens,
            workdir: currentWorkdir,
        });
        if (envUnwrap.changed) {
            currentCommand = envUnwrap.tokens.join(" ").trim();
            currentWorkdir = envUnwrap.workdir;
            if (envUnwrap.wrapper) {
                wrappers.push(envUnwrap.wrapper);
            }
            continue;
        }

        const shellUnwrap = extractWechatShellInlineCommand({
            tokens,
            workdir: currentWorkdir,
        });
        if (shellUnwrap.changed && shellUnwrap.command) {
            currentCommand = shellUnwrap.command;
            currentWorkdir = shellUnwrap.workdir;
            if (shellUnwrap.wrapper) {
                wrappers.push(shellUnwrap.wrapper);
            }
            continue;
        }

        break;
    }

    return {
        command: currentCommand,
        workdir: currentWorkdir,
        wrappers,
    };
}

function resolveWechatCommandPathCandidate(token: string, workdir?: string): string | null {
    const raw = unquoteWechatShellToken(token);
    if (!raw) {
        return null;
    }
    const looksLikePath =
        raw.includes("/") ||
        raw.includes("\\") ||
        raw.startsWith(".") ||
        raw.startsWith("~") ||
        raw.toLowerCase() === "skill.md" ||
        WECHAT_SKILL_SCRIPT_EXTENSIONS.has(path.extname(raw).toLowerCase());
    if (!looksLikePath) {
        return null;
    }
    const expanded = raw.startsWith("~")
        ? path.join(
              process.env.HOME || process.env.USERPROFILE || "",
              raw.length > 1 && (raw[1] === "/" || raw[1] === "\\") ? raw.slice(2) : raw.slice(1)
          )
        : raw;
    const baseDir = workdir?.trim() ? workdir : process.cwd();
    return path.resolve(baseDir, expanded);
}

function isWechatPathWithinRoots(filePath: string, roots: string[]): boolean {
    return roots.some((root) => {
        const relative = path.relative(root, filePath);
        return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
    });
}

type WechatInstalledSkillMatchInfo = {
    matched: boolean;
    reason?: "wrapper" | "script-path" | "skill-cwd-cli" | "readonly-probe";
    skillId?: string;
    segment?: string;
    path?: string;
    wrappers?: string[];
};

function resolveWechatSkillIdFromPath(filePath: string, skillRoots: string[]): string | undefined {
    const normalizedFile = path.resolve(filePath);
    for (const root of skillRoots) {
        const relative = path.relative(root, normalizedFile);
        if (relative.startsWith("..") || path.isAbsolute(relative)) {
            continue;
        }
        const segments = relative.split(path.sep).filter(Boolean);
        const skillId = segments[0]?.trim().toLowerCase();
        if (skillId) {
            return skillId;
        }
    }
    return undefined;
}

function resolveWechatSkillPreludeReadSegment(segment: string, workdir: string | undefined, skillRoots: string[]): {
    matched: boolean;
    skillId?: string;
    path?: string;
} {
    const tokens = splitWechatShellTokens(segment);
    if (tokens.length !== 2 || normalizeWechatExecutableBase(tokens[0]) !== "cat") {
        return { matched: false };
    }
    const candidatePath = resolveWechatCommandPathCandidate(tokens[1], workdir);
    if (!candidatePath ||
        !candidatePath.toLowerCase().endsWith(`${path.sep}SKILL.md`.toLowerCase()) ||
        !isWechatPathWithinRoots(candidatePath, skillRoots)) {
        return { matched: false };
    }
    return {
        matched: true,
        skillId: resolveWechatSkillIdFromPath(candidatePath, skillRoots),
        path: candidatePath,
    };
}

function isWechatSkillPreludeMarkerSegment(segment: string): boolean {
    const tokens = splitWechatShellTokens(segment);
    return tokens.length === 2 &&
        normalizeWechatExecutableBase(tokens[0]) === "printf" &&
        WECHAT_SKILL_MARKER_VALUES.has(unquoteWechatShellToken(tokens[1]));
}

function resolveWechatSkillCdSegment(segment: string, workdir: string | undefined, skillRoots: string[]): string | null {
    const tokens = splitWechatShellTokens(segment);
    if (tokens.length !== 2 || normalizeWechatExecutableBase(tokens[0]) !== "cd") {
        return null;
    }
    const candidatePath = resolveWechatCommandPathCandidate(tokens[1], workdir);
    if (!candidatePath || !isWechatPathWithinRoots(candidatePath, skillRoots)) {
        return null;
    }
    return candidatePath;
}

function isWechatSkillSourceSegment(segment: string, workdir: string | undefined, skillRoots: string[]): boolean {
    const tokens = splitWechatShellTokens(segment);
    if (tokens.length !== 2) {
        return false;
    }
    const commandToken = normalizeWechatExecutableBase(tokens[0]);
    if (commandToken !== "source" && commandToken !== ".") {
        return false;
    }
    const candidatePath = resolveWechatCommandPathCandidate(tokens[1], workdir);
    return Boolean(candidatePath && isWechatPathWithinRoots(candidatePath, skillRoots));
}

function buildWechatReadonlyProbeMatch(params: {
    segment: string;
    skillRoots: string[];
    path: string;
}): WechatInstalledSkillMatchInfo {
    return {
        matched: true,
        reason: "readonly-probe",
        skillId: resolveWechatSkillIdFromPath(params.path, params.skillRoots),
        segment: params.segment,
        path: params.path,
    };
}

function resolveWechatReadonlyProbeTargetPaths(params: {
    tokens: string[];
    startIndex: number;
    workdir?: string;
    skillRoots: string[];
    allowEmpty?: boolean;
}): string[] | null {
    const rawPathTokens = params.tokens.slice(params.startIndex).filter((token) => {
        const raw = unquoteWechatShellToken(token).trim();
        return Boolean(raw) && !raw.startsWith("-");
    });

    if (rawPathTokens.length === 0) {
        if (!params.allowEmpty || !params.workdir) {
            return null;
        }
        const resolvedWorkdir = path.resolve(params.workdir);
        return isWechatPathWithinRoots(resolvedWorkdir, params.skillRoots)
            ? [resolvedWorkdir]
            : null;
    }

    const resolvedTargets = rawPathTokens
        .map((token) => resolveWechatCommandPathCandidate(token, params.workdir))
        .filter((entry): entry is string => Boolean(entry));
    if (resolvedTargets.length !== rawPathTokens.length) {
        return null;
    }
    if (!resolvedTargets.every((entry) => isWechatPathWithinRoots(entry, params.skillRoots))) {
        return null;
    }
    return resolvedTargets;
}

function resolveWechatFindProbeSegment(params: {
    segment: string;
    tokens: string[];
    workdir?: string;
    skillRoots: string[];
}): WechatInstalledSkillMatchInfo {
    let index = 1;
    const pathTokens: string[] = [];

    while (index < params.tokens.length) {
        const raw = unquoteWechatShellToken(params.tokens[index]).trim();
        if (!raw || raw.startsWith("-") || raw === "!" || raw === "(" || raw === ")" || raw === "\\(" || raw === "\\)") {
            break;
        }
        pathTokens.push(params.tokens[index]);
        index += 1;
    }

    const resolvedTargets = resolveWechatReadonlyProbeTargetPaths({
        tokens: pathTokens,
        startIndex: 0,
        workdir: params.workdir,
        skillRoots: params.skillRoots,
        allowEmpty: true,
    });
    if (!resolvedTargets || resolvedTargets.length === 0) {
        return { matched: false };
    }

    while (index < params.tokens.length) {
        const raw = unquoteWechatShellToken(params.tokens[index]).trim();
        const lower = raw.toLowerCase();
        if (!raw) {
            index += 1;
            continue;
        }

        if (lower === "-maxdepth" || lower === "-mindepth") {
            const value = unquoteWechatShellToken(params.tokens[index + 1] || "").trim();
            if (!/^\d+$/.test(value)) {
                return { matched: false };
            }
            index += 2;
            continue;
        }
        if (lower === "-type") {
            const value = unquoteWechatShellToken(params.tokens[index + 1] || "").trim().toLowerCase();
            if (!/^[fdl]$/.test(value)) {
                return { matched: false };
            }
            index += 2;
            continue;
        }
        if (
            lower === "-name" ||
            lower === "-iname" ||
            lower === "-path" ||
            lower === "-ipath"
        ) {
            const value = unquoteWechatShellToken(params.tokens[index + 1] || "").trim();
            if (!value) {
                return { matched: false };
            }
            index += 2;
            continue;
        }
        if (
            lower === "-print" ||
            lower === "-a" ||
            lower === "-o" ||
            lower === "-not" ||
            raw === "!" ||
            raw === "(" ||
            raw === ")" ||
            raw === "\\(" ||
            raw === "\\)"
        ) {
            index += 1;
            continue;
        }

        return { matched: false };
    }

    return buildWechatReadonlyProbeMatch({
        segment: params.segment,
        skillRoots: params.skillRoots,
        path: resolvedTargets[0],
    });
}

function resolveWechatSkillReadonlyProbeSegment(params: {
    segment: string;
    workdir?: string;
    skillRoots: string[];
}): WechatInstalledSkillMatchInfo {
    const tokens = splitWechatShellTokens(params.segment);
    if (tokens.length === 0) {
        return { matched: false };
    }
    const execBase = normalizeWechatExecutableBase(tokens[0]);

    if (execBase === "pwd") {
        if (tokens.length !== 1 || !params.workdir) {
            return { matched: false };
        }
        const resolvedWorkdir = path.resolve(params.workdir);
        if (!isWechatPathWithinRoots(resolvedWorkdir, params.skillRoots)) {
            return { matched: false };
        }
        return buildWechatReadonlyProbeMatch({
            segment: params.segment,
            skillRoots: params.skillRoots,
            path: resolvedWorkdir,
        });
    }

    if (execBase === "find") {
        return resolveWechatFindProbeSegment({
            segment: params.segment,
            tokens,
            workdir: params.workdir,
            skillRoots: params.skillRoots,
        });
    }

    if (execBase === "test") {
        if (tokens.length !== 3) {
            return { matched: false };
        }
        const flag = unquoteWechatShellToken(tokens[1]).trim().toLowerCase();
        if (!new Set(["-e", "-f", "-d", "-l", "-r", "-w", "-x", "-s"]).has(flag)) {
            return { matched: false };
        }
        const resolvedTargets = resolveWechatReadonlyProbeTargetPaths({
            tokens: [tokens[2]],
            startIndex: 0,
            workdir: params.workdir,
            skillRoots: params.skillRoots,
        });
        if (!resolvedTargets || resolvedTargets.length !== 1) {
            return { matched: false };
        }
        return buildWechatReadonlyProbeMatch({
            segment: params.segment,
            skillRoots: params.skillRoots,
            path: resolvedTargets[0],
        });
    }

    if (execBase === "ls" || execBase === "stat" || execBase === "readlink") {
        const resolvedTargets = resolveWechatReadonlyProbeTargetPaths({
            tokens,
            startIndex: 1,
            workdir: params.workdir,
            skillRoots: params.skillRoots,
            allowEmpty: true,
        });
        if (!resolvedTargets || resolvedTargets.length === 0) {
            return { matched: false };
        }
        return buildWechatReadonlyProbeMatch({
            segment: params.segment,
            skillRoots: params.skillRoots,
            path: resolvedTargets[0],
        });
    }

    return { matched: false };
}

function resolveWechatSkillExecSegment(params: {
    segment: string;
    workdir?: string;
    skillRoots: string[];
    skillIds: Set<string>;
}): WechatInstalledSkillMatchInfo {
    const tokens = splitWechatShellTokens(params.segment);
    if (tokens.length === 0) {
        return { matched: false };
    }

    const execBase = normalizeWechatExecutableBase(tokens[0]);
    if (execBase.endsWith("-wrapper") && params.skillIds.has(execBase.slice(0, -"-wrapper".length))) {
        return {
            matched: true,
            reason: "wrapper",
            skillId: execBase.slice(0, -"-wrapper".length),
            segment: params.segment,
        };
    }

    const resolvedExecPath = resolveWechatCommandPathCandidate(tokens[0], params.workdir);
    if (resolvedExecPath && isWechatPathWithinRoots(resolvedExecPath, params.skillRoots)) {
        return {
            matched: true,
            reason: "script-path",
            skillId: resolveWechatSkillIdFromPath(resolvedExecPath, params.skillRoots),
            segment: params.segment,
            path: resolvedExecPath,
        };
    }

    const readonlyProbeMatch = resolveWechatSkillReadonlyProbeSegment({
        segment: params.segment,
        workdir: params.workdir,
        skillRoots: params.skillRoots,
    });
    if (readonlyProbeMatch.matched) {
        return readonlyProbeMatch;
    }

    const resolvedPathCandidates = tokens
        .map((token) => resolveWechatCommandPathCandidate(token, params.workdir))
        .filter((entry): entry is string => Boolean(entry));
    const skillLocalPaths = resolvedPathCandidates.filter((entry) => isWechatPathWithinRoots(entry, params.skillRoots));
    const hasSkillScriptPath = skillLocalPaths.some((entry) =>
        WECHAT_SKILL_SCRIPT_EXTENSIONS.has(path.extname(entry).toLowerCase()),
    );
    const hasInlineEvalFlag = tokens.some((token) => {
        const raw = unquoteWechatShellToken(token).trim().toLowerCase();
        return raw === "-c" || raw === "-e" || raw === "--eval" || raw.startsWith("--eval=");
    });

    if (hasInlineEvalFlag) {
        for (const skillId of params.skillIds) {
            if (params.segment.includes(skillId)) {
                return {
                    matched: true,
                    reason: "inline-eval-fallback",
                    skillId: skillId,
                    segment: params.segment,
                };
            }
        }
        return { matched: false };
    }

    if (hasSkillScriptPath) {
        const matchedPath = skillLocalPaths.find((entry) =>
            WECHAT_SKILL_SCRIPT_EXTENSIONS.has(path.extname(entry).toLowerCase()),
        );
        return {
            matched: true,
            reason: "script-path",
            skillId: matchedPath ? resolveWechatSkillIdFromPath(matchedPath, params.skillRoots) : undefined,
            segment: params.segment,
            path: matchedPath,
        };
    }

    if (params.workdir && isWechatPathWithinRoots(path.resolve(params.workdir), params.skillRoots)) {
        if (WECHAT_SKILL_LOCAL_EXECUTABLES.has(execBase)) {
            return {
                matched: true,
                reason: "skill-cwd-cli",
                skillId: resolveWechatSkillIdFromPath(path.resolve(params.workdir), params.skillRoots),
                segment: params.segment,
                path: path.resolve(params.workdir),
            };
        }
    }

    return { matched: false };
}

function resolveWechatInstalledSkillCommandMatch(command: string, workdir: string | undefined, config: ReturnType<typeof resolveWechatExtensionConfig>): WechatInstalledSkillMatchInfo {
    const trimmed = command.trim();
    if (!trimmed) {
        return { matched: false };
    }

    const { roots: skillRoots, skillIds } = resolveWechatInstalledSkillsSnapshot(config);
    if (skillRoots.length === 0 || skillIds.size === 0) {
        return { matched: false };
    }

    const unwrappedCommand = unwrapWechatInstalledSkillCommand(trimmed, workdir);
    const segments = splitWechatShellSegments(unwrappedCommand.command);
    if (segments.length === 0) {
        return { matched: false };
    }

    let currentWorkdir = unwrappedCommand.workdir?.trim() || process.cwd();
    let matchedSkillExec: WechatInstalledSkillMatchInfo | null = null;
    let preludeSkillId: string | undefined;

    for (const segment of segments) {
        const preludeRead = resolveWechatSkillPreludeReadSegment(segment, currentWorkdir, skillRoots);
        if (preludeRead.matched) {
            preludeSkillId = preludeRead.skillId || preludeSkillId;
            continue;
        }
        if (isWechatSkillPreludeMarkerSegment(segment)) {
            continue;
        }

        const cdTarget = resolveWechatSkillCdSegment(segment, currentWorkdir, skillRoots);
        if (cdTarget) {
            currentWorkdir = cdTarget;
            continue;
        }

        if (isWechatSkillSourceSegment(segment, currentWorkdir, skillRoots)) {
            continue;
        }

        const execMatch = resolveWechatSkillExecSegment({
            segment,
            workdir: currentWorkdir,
            skillRoots,
            skillIds,
        });
        if (execMatch.matched) {
            matchedSkillExec = {
                ...execMatch,
                skillId: execMatch.skillId || preludeSkillId,
                wrappers: unwrappedCommand.wrappers,
            };
            continue;
        }

        return { matched: false };
    }

    return matchedSkillExec || { matched: false };
}

function summarizeWechatInstalledSkillMatch(match: WechatInstalledSkillMatchInfo): string {
    if (!match.matched) {
        return "";
    }
    const parts: string[] = [];
    if (match.skillId) {
        parts.push(`skill=${match.skillId}`);
    }
    if (match.reason) {
        parts.push(`reason=${match.reason}`);
    }
    if (match.segment) {
        parts.push(`segment="${summarizeWechatTextForLog(match.segment, 120)}"`);
    }
    if (match.path) {
        parts.push(`path="${summarizeWechatTextForLog(match.path, 160)}"`);
    }
    if (match.wrappers && match.wrappers.length > 0) {
        parts.push(`via=${match.wrappers.join(">")}`);
    }
    return parts.join(" ");
}

function summarizeWechatSkillRootsForLog(roots: string[]): string {
    if (roots.length === 0) {
        return "roots=0";
    }
    const preview = roots
        .slice(0, 3)
        .map((entry) => summarizeWechatTextForLog(entry, 80))
        .join(",");
    return roots.length > 3
        ? `roots=${roots.length} sample="${preview},..."`
        : `roots=${roots.length} sample="${preview}"`;
}

function buildWechatInstalledSkillDebugSummary(command: string, workdir: string | undefined, config: ReturnType<typeof resolveWechatExtensionConfig>): string {
    const trimmed = command.trim();
    if (!trimmed) {
        return "reason=empty-command";
    }

    const { roots: skillRoots, skillIds } = resolveWechatInstalledSkillsSnapshot(config);
    if (skillRoots.length === 0 || skillIds.size === 0) {
        return `reason=no-skill-roots ${summarizeWechatSkillRootsForLog(skillRoots)} skills=${skillIds.size}`;
    }

    const unwrapped = unwrapWechatInstalledSkillCommand(trimmed, workdir);
    const segments = splitWechatShellSegments(unwrapped.command);
    const viaSummary = unwrapped.wrappers.length > 0 ? ` via=${unwrapped.wrappers.join(">")}` : "";
    const workdirSummary = unwrapped.workdir
        ? ` workdir="${summarizeWechatTextForLog(unwrapped.workdir, 100)}"`
        : "";

    if (segments.length === 0) {
        return `reason=no-segments ${summarizeWechatSkillRootsForLog(skillRoots)}${viaSummary}${workdirSummary}`;
    }

    let currentWorkdir = unwrapped.workdir?.trim() || process.cwd();
    let sawSkillExec = false;

    for (const segment of segments) {
        const preludeRead = resolveWechatSkillPreludeReadSegment(segment, currentWorkdir, skillRoots);
        if (preludeRead.matched) {
            continue;
        }
        if (isWechatSkillPreludeMarkerSegment(segment)) {
            continue;
        }

        const cdTarget = resolveWechatSkillCdSegment(segment, currentWorkdir, skillRoots);
        if (cdTarget) {
            currentWorkdir = cdTarget;
            continue;
        }

        if (isWechatSkillSourceSegment(segment, currentWorkdir, skillRoots)) {
            continue;
        }

        const execMatch = resolveWechatSkillExecSegment({
            segment,
            workdir: currentWorkdir,
            skillRoots,
            skillIds,
        });
        if (execMatch.matched) {
            sawSkillExec = true;
            continue;
        }

        return `reason=segment-not-trusted segment="${summarizeWechatTextForLog(segment, 140)}"${viaSummary}${workdirSummary} ${summarizeWechatSkillRootsForLog(skillRoots)}`;
    }

    if (!sawSkillExec) {
        return `reason=no-skill-exec segments=${segments.length}${viaSummary}${workdirSummary} ${summarizeWechatSkillRootsForLog(skillRoots)}`;
    }

    return `reason=matched-without-record ${summarizeWechatSkillRootsForLog(skillRoots)}${viaSummary}${workdirSummary}`;
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

function isWechatLogRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function summarizeWechatUrlForLog(value: unknown, maxLength = 160): string {
    if (typeof value !== "string") {
        return "";
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return "";
    }
    try {
        const parsed = new URL(trimmed);
        const normalized = `${parsed.origin}${parsed.pathname || "/"}${parsed.search ? "?..." : ""}${parsed.hash ? "#..." : ""}`;
        return summarizeWechatTextForLog(normalized, maxLength);
    } catch {
        return summarizeWechatTextForLog(trimmed, maxLength);
    }
}

function summarizeWechatToolParamsForLog(toolName: string, params: Record<string, unknown> | undefined): string {
    if (!params) {
        return "params=none";
    }

    if (toolName !== "web_fetch") {
        return `paramKeys=${Object.keys(params).length}`;
    }

    const parts: string[] = [];
    const urlSummary = summarizeWechatUrlForLog(params.url);
    const extractMode = typeof params.extractMode === "string" ? params.extractMode.trim() : "";
    const maxChars = typeof params.maxChars === "number" && Number.isFinite(params.maxChars)
        ? Math.max(0, Math.floor(params.maxChars))
        : undefined;

    if (urlSummary) {
        parts.push(`url="${urlSummary}"`);
    }
    if (extractMode) {
        parts.push(`extractMode=${extractMode}`);
    }
    if (maxChars !== undefined) {
        parts.push(`maxChars=${maxChars}`);
    }

    return parts.length > 0 ? parts.join(" ") : "params=empty";
}

function summarizeWechatToolResultForLog(toolName: string, result: unknown, error?: string): string {
    const record = isWechatLogRecord(result) ? result : undefined;
    const parts: string[] = [];
    const directError = typeof error === "string" ? error.trim() : "";
    const resultError = typeof record?.error === "string" ? record.error.trim() : "";
    const effectiveError = directError || resultError;

    parts.push(`outcome=${effectiveError ? "error" : "success"}`);

    if (toolName === "web_fetch") {
        const finalUrlSummary = summarizeWechatUrlForLog(record?.finalUrl);
        const status = typeof record?.status === "number" && Number.isFinite(record.status)
            ? Math.max(0, Math.floor(record.status))
            : undefined;
        const contentType = typeof record?.contentType === "string" ? record.contentType.trim() : "";
        const extractor = typeof record?.extractor === "string" ? record.extractor.trim() : "";
        const cached = typeof record?.cached === "boolean" ? record.cached : undefined;
        const truncated = typeof record?.truncated === "boolean" ? record.truncated : undefined;
        const length = typeof record?.length === "number" && Number.isFinite(record.length)
            ? Math.max(0, Math.floor(record.length))
            : undefined;
        const tookMs = typeof record?.tookMs === "number" && Number.isFinite(record.tookMs)
            ? Math.max(0, Math.floor(record.tookMs))
            : undefined;

        if (status !== undefined) {
            parts.push(`status=${status}`);
        }
        if (finalUrlSummary) {
            parts.push(`finalUrl="${finalUrlSummary}"`);
        }
        if (contentType) {
            parts.push(`contentType=${contentType}`);
        }
        if (extractor) {
            parts.push(`extractor=${extractor}`);
        }
        if (cached !== undefined) {
            parts.push(`cached=${cached}`);
        }
        if (truncated !== undefined) {
            parts.push(`truncated=${truncated}`);
        }
        if (length !== undefined) {
            parts.push(`length=${length}`);
        }
        if (tookMs !== undefined) {
            parts.push(`tookMs=${tookMs}`);
        }
    }

    if (effectiveError) {
        parts.push(`error="${summarizeWechatTextForLog(effectiveError, 180)}"`);
    }

    return parts.join(" ");
}

function isWechatInternalStatusReply(text: string): { matched: boolean; reason?: string } {
    const normalized = text.replace(/\r\n/g, "\n").trim();
    if (!normalized) {
        return { matched: false };
    }

    if (/^Wait for completion from child session\s+`agent:[^`]+:subagent:[^`]+`\.\.\.$/i.test(normalized)) {
        return { matched: true, reason: "child-session-wait" };
    }

    return { matched: false };
}

function isWechatPermissionDeniedReply(text: string): boolean {
    const normalized = text.replace(/\r\n/g, "\n").trim();
    if (!normalized) {
        return false;
    }

    return [
        /你没有这个权限/u,
        /没有权限调用敏感工具/u,
        /无权限/u,
        /审批被拒绝/u,
        /\bnot authorized\b/i,
        /\bpermission denied\b/i,
        /\bonly boss\b/i,
    ].some((pattern) => pattern.test(normalized));
}

function isWechatToolFailureSummaryReply(text: string): boolean {
    const normalized = text.replace(/\r\n/g, "\n").trim();
    if (!normalized) {
        return false;
    }

    return /^⚠️(?:\s*[^\w\s]+\s*)*[A-Za-z][\w-]*:\s*[\s\S]*\bfailed\b[.!?]*$/i.test(normalized);
}

function shouldSuppressWechatToolFailureSummary(params: {
    payload: Record<string, any>;
    text: string;
    cumulativeSentText: string;
}): { matched: boolean; reason?: string } {
    const normalized = params.text.replace(/\r\n/g, "\n").trim();
    if (!normalized) {
        return { matched: false };
    }

    if (params.payload?.isError !== true) {
        return { matched: false };
    }

    if (isWechatToolFailureSummaryReply(normalized)) {
        if (params.cumulativeSentText && isWechatPermissionDeniedReply(params.cumulativeSentText)) {
            return { matched: true, reason: "post-deny-tool-failure-summary" };
        }
        return { matched: true, reason: "internal-tool-failure-summary" };
    }

    return { matched: false };
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
    skillId?: string;
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
        skillId: params.authContext.skillId || "",
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
    const skillLabel = params.authContext.skillId ? ` / skill=${params.authContext.skillId}` : "";
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
            return params.authContext.skillId
                ? `当前 skill 已禁止普通用户使用: ${params.authContext.skillId}\n关联工具: ${toolLabel}\n如需执行，请由主人微信发起。`
                : `你没有权限调用敏感工具: ${toolLabel}${skillLabel}\n如需执行，请由主人微信发起，或改成审批模式。`;
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

function claimWechatToolNoticeDedup(params: {
    to: string;
    messageId?: string;
    text: string;
}): boolean {
    const state = getGlobalState();
    const now = Date.now();
    const dedupMap = state.recentToolNoticeAt;

    for (const [key, timestamp] of dedupMap) {
        if (now - timestamp > WECHAT_TOOL_NOTICE_DEDUP_TTL_MS) {
            dedupMap.delete(key);
        }
    }

    const normalizedText = params.text.replace(/\s+/g, " ").trim();
    const dedupKey = `${params.to}|${params.messageId || ""}|${normalizedText}`;
    const lastSentAt = dedupMap.get(dedupKey);
    if (lastSentAt && now - lastSentAt <= WECHAT_TOOL_NOTICE_DEDUP_TTL_MS) {
        return false;
    }
    dedupMap.set(dedupKey, now);
    return true;
}

function claimWechatToolAuthLogDedup(params: {
    kind: string;
    runId?: string;
    toolName?: string;
    skillId?: string;
    detail?: string;
}): boolean {
    const state = getGlobalState();
    const now = Date.now();
    const dedupMap = state.recentToolAuthLogAt;

    for (const [key, timestamp] of dedupMap) {
        if (now - timestamp > WECHAT_TOOL_AUTH_LOG_DEDUP_TTL_MS) {
            dedupMap.delete(key);
        }
    }

    const dedupKey = [
        params.kind.trim(),
        params.runId?.trim() || "",
        params.toolName?.trim().toLowerCase() || "",
        params.skillId?.trim().toLowerCase() || "",
        (params.detail || "").replace(/\s+/g, " ").trim(),
    ].join("|");
    const lastLoggedAt = dedupMap.get(dedupKey);
    if (lastLoggedAt && now - lastLoggedAt <= WECHAT_TOOL_AUTH_LOG_DEDUP_TTL_MS) {
        return false;
    }
    dedupMap.set(dedupKey, now);
    return true;
}

function pruneWechatReplyMediaDedupMap(now = Date.now()) {
    const dedupMap = getGlobalState().recentReplyMediaAt;
    for (const [key, timestamp] of dedupMap) {
        if (now - timestamp > WECHAT_REPLY_MEDIA_DEDUP_TTL_MS) {
            dedupMap.delete(key);
        }
    }
}

function buildWechatReplyMediaDedupKey(params: {
    sessionKey: string;
    dispatchId?: string;
    mediaDedupKey: string;
}): string {
    return [
        params.sessionKey.trim(),
        params.dispatchId?.trim() || "no-dispatch-id",
        params.mediaDedupKey.trim(),
    ].join("|");
}

function hasRecentWechatReplyMedia(dedupKey: string): boolean {
    const now = Date.now();
    pruneWechatReplyMediaDedupMap(now);
    const seenAt = getGlobalState().recentReplyMediaAt.get(dedupKey);
    return typeof seenAt === "number" && now - seenAt <= WECHAT_REPLY_MEDIA_DEDUP_TTL_MS;
}

function claimWechatReplyMediaDedup(dedupKey: string): boolean {
    const now = Date.now();
    pruneWechatReplyMediaDedupMap(now);
    const dedupMap = getGlobalState().recentReplyMediaAt;
    const seenAt = dedupMap.get(dedupKey);
    if (typeof seenAt === "number" && now - seenAt <= WECHAT_REPLY_MEDIA_DEDUP_TTL_MS) {
        return false;
    }
    dedupMap.set(dedupKey, now);
    return true;
}

function releaseWechatReplyMediaDedup(dedupKey: string) {
    getGlobalState().recentReplyMediaAt.delete(dedupKey);
}

async function sendWechatToolAuthNotice(api: OpenClawPluginApi, authContext: {
    from?: string;
    accountId?: string;
    messageId?: string;
    [key: string]: unknown;
}, text: string): Promise<void> {
    const to = authContext.from?.trim();
    const trimmedText = text.trim();
    if (!to || !trimmedText) {
        return;
    }
    if (!claimWechatToolNoticeDedup({
        to,
        messageId: authContext.messageId,
        text: trimmedText,
    })) {
        api.logger.debug?.(
            `[WeChat ToolAuth] Skipping duplicate notice to ${to} msgId=${authContext.messageId || ""} text="${summarizeWechatTextForLog(trimmedText, 120)}"`,
        );
        return;
    }
    try {
        const cfg = api.runtime.config.current();
        await wechatPlugin.outbound?.sendText?.({
            to,
            text: trimmedText,
            msg_id: authContext.messageId,
            accountId: authContext.accountId || "default",
            cfg,
        } as any);
    } catch (error: any) {
        api.logger.warn?.(`[WeChat ToolAuth] Failed to send notice to ${to}: ${error?.message || String(error)}`);
    }
}

function resolveWechatFallbackNoticeContextFromSessionKey(sessionKey?: string): WechatToolNoticeContext | null {
    const trimmed = sessionKey?.trim();
    if (!trimmed) {
        return null;
    }

    const fallbackAuth = getWechatToolAuthFallbackForSession(trimmed);
    if (fallbackAuth?.from) {
        return {
            from: fallbackAuth.from,
            accountId: fallbackAuth.accountId || "default",
            messageId: fallbackAuth.messageId,
            chatType: fallbackAuth.chatType,
            conversationLabel: fallbackAuth.conversationLabel,
            senderId: fallbackAuth.senderId,
            senderName: fallbackAuth.senderName,
            content: fallbackAuth.content,
        };
    }

    const marker = ":wechat:";
    const markerIndex = trimmed.indexOf(marker);
    if (markerIndex < 0) {
        return null;
    }

    const suffix = trimmed.slice(markerIndex + marker.length);
    const separatorIndex = suffix.indexOf(":");
    if (separatorIndex <= 0) {
        return null;
    }

    const chatTypeValue = suffix.slice(0, separatorIndex).trim();
    if (chatTypeValue !== "group" && chatTypeValue !== "direct") {
        return null;
    }

    const from = suffix.slice(separatorIndex + 1).trim();
    if (!from) {
        return null;
    }

    const chatType = chatTypeValue as "group" | "direct";
    return {
        from,
        accountId: "default",
        chatType,
        conversationLabel: from,
        senderId: chatType === "direct" ? from : undefined,
        senderName: chatType === "direct" ? from : undefined,
    };
}

function shouldApplyWechatToolAuth(params: {
    sessionKey?: string;
    runId?: string;
}): boolean {
    const sessionKey = params.sessionKey?.trim();
    if (sessionKey?.includes(":wechat:")) {
        return true;
    }
    if (sessionKey && (
        getWechatToolAuthForSession(sessionKey) ||
        getWechatToolAuthFallbackForSession(sessionKey)
    )) {
        return true;
    }
    const runId = params.runId?.trim();
    if (runId && getWechatToolAuthForRun(runId)) {
        return true;
    }
    return false;
}

function readWechatContextString(
    ctx: Record<string, unknown> | undefined,
    keys: string[],
): string | undefined {
    for (const key of keys) {
        const value = ctx?.[key];
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }
    return undefined;
}

function resolveWechatContextSessionKey(ctx: Record<string, unknown> | undefined): string | undefined {
    return readWechatContextString(ctx, ["sessionKey", "SessionKey"]);
}

function resolveWechatContextSenderId(
    ctx: Record<string, unknown> | undefined,
    fallback?: unknown,
): string | undefined {
    return readWechatContextString(ctx, ["senderId", "SenderId"]) ||
        (typeof fallback === "string" && fallback.trim() ? fallback.trim() : undefined);
}

function resolveWechatContextBody(
    ctx: Record<string, unknown> | undefined,
    fallback?: unknown,
): string | undefined {
    return readWechatContextString(ctx, ["body", "Body", "content", "Content"]) ||
        (typeof fallback === "string" && fallback.trim() ? fallback.trim() : undefined);
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

function attachBridgeClientSocketHandlers(api: OpenClawPluginApi, socket: WebSocket) {
    setActiveBridgeSocket(socket);
    markBridgePong();

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
        const state = getGlobalState();
        if (getActiveBridgeSocket() === socket) {
            setActiveBridgeSocket(null);
        }
        state.clientConnecting = false;
        api.logger.warn(`[WeChat] Bridge WS disconnected code=${code}`);
        scheduleBridgeClientReconnect(api, "socket-close");
    });

    socket.on("error", (err: any) => {
        api.logger.warn(`[WeChat] Bridge WS client error: ${err?.message || err}`);
    });
}

function initializeBridgeClientState() {
    bridgeWss = null;
    setWechatWsServer(null);
    syncStateFromModuleRefs();
}

type WechatBridgeWsConfig = {
    host: string;
    port: number;
    path: string;
};

function installBridgeHeartbeat(api: OpenClawPluginApi, state = getGlobalState()) {
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
        socket.send(JSON.stringify(buildFrame("openclaw_to_bridge", "ping")));
    }, 30000);

    state.heartbeatTimer = bridgeHeartbeatTimer;
}

function buildWechatBridgeServerUrl(wsConfig: WechatBridgeWsConfig): string {
    return `ws://${wsConfig.host}:${wsConfig.port}${wsConfig.path}`;
}

function scheduleBridgeClientReconnect(api: OpenClawPluginApi, reason: string) {
    if (bridgeClientReconnectTimer || bridgeClosePromise) {
        return;
    }
    api.logger.info(`[WeChat] Scheduling bridge reconnect (${reason})`);
    bridgeClientReconnectTimer = setTimeout(() => {
        bridgeClientReconnectTimer = null;
        void ensureBridgeStarted(api).catch((err) => {
            handleBridgeStartFailure(api, err);
        });
    }, 2000);
}

async function connectBridgeClient(api: OpenClawPluginApi, wsConfig: WechatBridgeWsConfig) {
    const state = getGlobalState();
    if (state.clientConnecting) {
        return;
    }
    const activeSocket = getActiveBridgeSocket();
    if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
        return;
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
            attachBridgeClientSocketHandlers(api, socket);
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

function handleBridgeStartFailure(api: OpenClawPluginApi, err: unknown) {
    const state = getGlobalState();
    clearBridgeStateRefs(state);
    clearBridgeRuntimeState();
    logBridgeState(api, "start:failed-cleared", state);
    api.logger.error(
        `[WeChat] Bridge start failure: ${err instanceof Error ? err.message : String(err)}`,
    );
    if (!state.closing) {
        scheduleBridgeClientReconnect(api, "start-failure");
    }
}

async function ensureBridgeStarted(api: OpenClawPluginApi) {
    const startState = getGlobalState();
    if (startState.startPromise) {
        await startState.startPromise;
        return;
    }

    const performStart = async () => {
        const runtime = api.runtime;
        const cfg = runtime.config.current();
        const bridgeConfig = resolveWechatExtensionConfig(cfg, api.logger);
        const wsConfig: WechatBridgeWsConfig = {
            host: bridgeConfig.wsHost,
            port: bridgeConfig.wsPort,
            path: bridgeConfig.wsPath,
        };
        const targetUrl = buildWechatBridgeServerUrl(wsConfig);

        api.logger.debug(
            `[WeChat] Bridge Config: wsHost=${wsConfig.host}, wsPort=${wsConfig.port}, wsPath=${wsConfig.path}`,
        );
        logBridgeState(api, "start:before-wait");

        if (bridgeClosePromise) {
            api.logger.debug("[WeChat] Waiting for previous bridge shutdown to finish before starting.");
            await bridgeClosePromise;
            logBridgeState(api, "start:after-wait");
        }

        const state = getGlobalState();
        syncModuleRefsFromState(state);

        initializeBridgeClientState();
        logBridgeState(api, "start:client-ready", state);

        await connectBridgeClient(api, wsConfig);
        installBridgeHeartbeat(api, state);
        syncStateFromModuleRefs(state);
        logBridgeState(api, "start:heartbeat-ready", state);
    };

    startState.startPromise = performStart().finally(() => {
        if (startState.startPromise) {
            startState.startPromise = null;
        }
    });

    await startState.startPromise;
}

function triggerBridgeStart(api: OpenClawPluginApi) {
    void ensureBridgeStarted(api).catch((err) => {
        handleBridgeStartFailure(api, err);
    });
}

function isWechatTruthyEnv(value: string | undefined): boolean | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
        return undefined;
    }
    if (["1", "true", "yes", "on"].includes(normalized)) {
        return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
        return false;
    }
    return undefined;
}

function hasWechatSupervisorHintEnv(): boolean {
    const keys = [
        "LAUNCH_JOB_LABEL",
        "LAUNCH_JOB_NAME",
        "XPC_SERVICE_NAME",
        "OPENCLAW_LAUNCHD_LABEL",
        "OPENCLAW_SYSTEMD_UNIT",
        "INVOCATION_ID",
        "SYSTEMD_EXEC_PID",
        "JOURNAL_STREAM",
        "OPENCLAW_WINDOWS_TASK_NAME",
        "OPENCLAW_SERVICE_MARKER",
    ];
    return keys.some((key) => {
        const value = process.env[key];
        return typeof value === "string" && value.trim().length > 0;
    });
}

function resolveWechatBridgeAutostartDecision(): {
    shouldStart: boolean;
    reason: string;
} {
    const envOverride = isWechatTruthyEnv(process.env.OPENCLAW_WECHAT_BRIDGE_AUTOSTART);
    if (envOverride !== undefined) {
        return {
            shouldStart: envOverride,
            reason: `env-override:${envOverride ? "on" : "off"}`,
        };
    }

    const argv = process.argv.map((entry) => entry.trim().toLowerCase());
    const gatewayIndex = argv.lastIndexOf("gateway");
    const gatewaySubcommand = gatewayIndex >= 0 ? argv[gatewayIndex + 1] : "";
    const hasImplicitGatewayRun =
        gatewayIndex >= 0 &&
        (!gatewaySubcommand || gatewaySubcommand.startsWith("-"));
    if (gatewaySubcommand === "stop") {
        return {
            shouldStart: false,
            reason: "explicit-cli:gateway-stop",
        };
    }

    const serviceKind = process.env.OPENCLAW_SERVICE_KIND?.trim().toLowerCase();
    if (serviceKind === "gateway" || serviceKind === "node") {
        return {
            shouldStart: true,
            reason: `service-kind:${serviceKind}`,
        };
    }

    if (hasWechatSupervisorHintEnv()) {
        return {
            shouldStart: true,
            reason: "supervised-service",
        };
    }

    if (hasImplicitGatewayRun) {
        return {
            shouldStart: true,
            reason: "implicit-cli:gateway",
        };
    }

    if (gatewayIndex >= 0 && gatewaySubcommand === "run") {
        return {
            shouldStart: true,
            reason: "explicit-cli:gateway-run",
        };
    }

    return {
        shouldStart: true,
        reason: "default-on",
    };
}

function maybeTriggerWechatBridgeStart(api: OpenClawPluginApi, reason: string): boolean {
    const decision = resolveWechatBridgeAutostartDecision();
    if (!decision.shouldStart) {
        api.logger.debug?.(
            `[WeChat] Skipping bridge auto-start (${reason}); decision=${decision.reason}.`,
        );
        return false;
    }
    api.logger.debug?.(
        `[WeChat] Auto-starting bridge (${reason}); decision=${decision.reason}.`,
    );
    triggerBridgeStart(api);
    return true;
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
    const cfg = runtime.config.current();

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
    const upstreamMessageTraceId = [
        body?.original_msg_id,
        body?.msg_id,
        body?.originalMsgId,
        body?.msgId,
    ]
        .map((value) => value == null ? "" : String(value).trim())
        .find(Boolean);
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
    const sessionKey = `agent:main:wechat:${chatType}:${from}`;

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
        conversationLabel,
        ConversationLabel: conversationLabel,
        groupSubject: isGroup ? (groupName || fromName || from) : undefined,
        GroupSubject: isGroup ? (groupName || fromName || from) : undefined,
        senderName: resolvedSenderName,
        SenderName: resolvedSenderName,
        senderId: resolvedSenderId,
        SenderId: resolvedSenderId,
        ownerAllowFrom: isMaster ? [resolvedSenderId] : undefined,
        OwnerAllowFrom: isMaster ? [resolvedSenderId] : undefined,
        isMaster,
        IsMaster: isMaster,
        senderIsOwner: isMaster,
        SenderIsOwner: isMaster,
        WeChatSenderRole: isMaster ? "owner" : "non-owner",
        WeChatAddressingInstruction: isMaster
            ? "This WeChat sender is the owner. Owner-style address terms are allowed."
            : "This WeChat sender is not the owner. Do not address this sender as Boss, boss, 主人, 老板, or 老大; use their senderName or a neutral address instead.",
        messageId,
        originalMsgId: upstreamMessageTraceId,
        OriginalMsgId: upstreamMessageTraceId,
        original_msg_id: upstreamMessageTraceId,
        MessageSid: messageId,
        MessageSidFull: messageId,
        from,
        From: from,
        to: accountId || "default",
        To: accountId || "default",
        isGroup,
        chatType,
        ChatType: chatType,
        sessionKey,
        SessionKey: sessionKey,
        threadId: from,
        content: content || "",
        body: content || "",
        Body: content || "",
        rawBody: content || "",
        RawBody: content || "",
        commandBody: content || "",
        CommandBody: content || "",
        msgId: messageId,
        MsgId: messageId,
        mediaPath,
        MediaPath: mediaPath,
        mediaType,
        MediaType: mediaType,
        mediaPaths: mediaPath ? [mediaPath] : undefined,
        MediaPaths: mediaPath ? [mediaPath] : undefined,
        mediaUrls: (media && typeof media.path === "string" && media.path.startsWith("http")) ? [media.path] : undefined,
        MediaUrls: (media && typeof media.path === "string" && media.path.startsWith("http")) ? [media.path] : undefined,
        mediaTypes: mediaType ? [mediaType] : undefined,
        MediaTypes: mediaType ? [mediaType] : undefined,
        images: mediaPath && mediaType?.startsWith("image/") ? [mediaPath] : undefined,
        Images: mediaPath && mediaType?.startsWith("image/") ? [mediaPath] : undefined,
        files: mediaPath ? [{
            path: mediaPath,
            mime: mediaType || "application/octet-stream",
            name: path.basename(mediaPath)
        }] : undefined,
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
        sessionKey,
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

    const bridgeConfig = resolveWechatExtensionConfig(cfg, api.logger);
    const blockedSkills = normalizeWechatSkillIdList(bridgeConfig.toolAuthBlockedSkills);
    const blockedSkillIntent = !isMaster
        ? matchWechatBlockedSkillIntent(content || "", blockedSkills)
        : { matched: false as const };
    if (blockedSkillIntent.matched && blockedSkillIntent.skillId) {
        const noticeContext: WechatToolNoticeContext = {
            from,
            accountId: accountId || "default",
            messageId,
            chatType,
            conversationLabel,
            senderId: resolvedSenderId,
            senderName: resolvedSenderName,
            skillId: blockedSkillIntent.skillId,
            content: content || "",
        };
        api.logger.warn(
            `[WeChat ToolAuth] Short-circuit blocked skill intent skill=${blockedSkillIntent.skillId} ` +
            `alias=${blockedSkillIntent.alias || ""} chatType=${chatType} from=${from} sender=${resolvedSenderId}`,
        );
        markWechatBlockedReplyForSession({
            sessionKey,
            toolName: "skill-intent",
            reason: `blocked-skill-intent:${blockedSkillIntent.skillId}`,
            noticeSent: false,
        });
        if (shouldSendWechatToolAuthNotice(bridgeConfig, {
            state: "blocked",
            chatType,
        })) {
            await sendWechatToolAuthNotice(
                api,
                noticeContext,
                buildWechatToolNoticeText({
                    toolName: blockedSkillIntent.skillId,
                    state: "blocked",
                    authContext: noticeContext,
                    config: bridgeConfig,
                }),
            );
        }
        return;
    }

    let cumulativeSentText = "";
    let turnTextSeen = "";
    const sentMediaKeys = new Set<string>();
    let pendingBlockMediaPaths: WechatMediaCandidate[] = [];
    let pendingBlockMediaTimer: ReturnType<typeof setTimeout> | null = null;
    const pendingBlockMediaDelayMs = 1200;
    const mediaDedupKeyCache = new Map<string, string>();
    const replyMediaDispatchId = upstreamMessageTraceId || messageId;

    const resolveMediaDedupKey = (mediaUrl: string) => {
        const trimmed = mediaUrl.trim();
        const cacheKey = isWechatLocalMediaReference(trimmed)
            ? `local:${path.resolve(trimmed)}`
            : `remote:${trimmed}`;
        const cached = mediaDedupKeyCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const dedupKey = buildWechatMediaDedupKey({
            mediaUrl: trimmed,
            logger: api.logger,
        });
        mediaDedupKeyCache.set(cacheKey, dedupKey);
        return dedupKey;
    };

    const buildReplyMediaScopeKey = (mediaDedupKey: string) =>
        buildWechatReplyMediaDedupKey({
            sessionKey,
            dispatchId: replyMediaDispatchId,
            mediaDedupKey,
        });

    const isRecentlySentReplyMedia = (mediaDedupKey: string) =>
        hasRecentWechatReplyMedia(buildReplyMediaScopeKey(mediaDedupKey));

    const sendReplyMediaCandidate = async (
        mediaCandidate: WechatMediaCandidate,
        source: "buffered-block" | "inline-directive" | "payload-media",
    ) => {
        if (!wechatPlugin.outbound?.sendMedia) {
            return false;
        }
        if (sentMediaKeys.has(mediaCandidate.dedupKey)) {
            return false;
        }

        const replyMediaScopeKey = buildReplyMediaScopeKey(mediaCandidate.dedupKey);
        if (!claimWechatReplyMediaDedup(replyMediaScopeKey)) {
            api.logger.info(
                `[WeChat] Skipping recent duplicate reply media session=${sessionKey} trace=${replyMediaDispatchId} ` +
                `source=${source} media="${summarizeWechatTextForLog(mediaCandidate.mediaUrl, 180)}"`,
            );
            return false;
        }

        sentMediaKeys.add(mediaCandidate.dedupKey);
        try {
            const sendResult = await wechatPlugin.outbound.sendMedia({
                to: from,
                mediaUrl: mediaCandidate.mediaUrl,
                text: "",
                msg_id: messageId,
                original_msg_id: upstreamMessageTraceId,
                accountId: accountId || "default",
                cfg,
            } as any);
            if (sendResult?.ok === false) {
                sentMediaKeys.delete(mediaCandidate.dedupKey);
                releaseWechatReplyMediaDedup(replyMediaScopeKey);
                return false;
            }
            return true;
        } catch (err) {
            sentMediaKeys.delete(mediaCandidate.dedupKey);
            releaseWechatReplyMediaDedup(replyMediaScopeKey);
            throw err;
        }
    };

    const clearPendingBlockMediaTimer = () => {
        if (pendingBlockMediaTimer) {
            clearTimeout(pendingBlockMediaTimer);
            pendingBlockMediaTimer = null;
        }
    };

    const takePendingBlockMediaPaths = () => {
        const uniquePending = pendingBlockMediaPaths.filter((candidate, index, list) =>
            !!candidate?.mediaUrl &&
            list.findIndex((item) => item.dedupKey === candidate.dedupKey) === index &&
            !sentMediaKeys.has(candidate.dedupKey) &&
            !isRecentlySentReplyMedia(candidate.dedupKey),
        );
        pendingBlockMediaPaths = [];
        return uniquePending;
    };

    const flushPendingBlockMediaPaths = async (reason: string) => {
        clearPendingBlockMediaTimer();
        const pendingMediaToSend = takePendingBlockMediaPaths();
        if (!pendingMediaToSend.length) {
            return;
        }

        api.logger.info(
            `[WeChat] Flushing buffered media-only block reason=${reason} count=${pendingMediaToSend.length}`,
        );

        for (const mediaCandidate of pendingMediaToSend) {
            await sendReplyMediaCandidate(mediaCandidate, "buffered-block");
        }
    };

    const schedulePendingBlockMediaFlush = () => {
        clearPendingBlockMediaTimer();
        pendingBlockMediaTimer = setTimeout(() => {
            void flushPendingBlockMediaPaths("timeout");
        }, pendingBlockMediaDelayMs);
    };

    const baseDispatcher = runtime.channel.reply.createReplyDispatcherWithTyping({
        onTyping: async () => { },
    } as any);

    const dispatchResult = await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
        ctx,
        cfg,
        dispatcherOptions: {
            ...baseDispatcher,
            deliver: async (...args: any[]) => {
                const bridgeConfig = resolveWechatExtensionConfig(cfg, api.logger);
                const replyAuthContext = {
                    from,
                    senderId: resolvedSenderId,
                    isMaster,
                };
                let localAttachmentBlocked = false;
                const notifyBlockedLocalAttachment = async () => {
                    if (localAttachmentBlocked) {
                        return;
                    }
                    localAttachmentBlocked = true;
                    if (!shouldSendWechatToolAuthNotice(bridgeConfig, {
                        state: "blocked",
                        chatType,
                    })) {
                        return;
                    }
                    await sendWechatToolAuthNotice(
                        api,
                        {
                            from,
                            accountId: accountId || "default",
                            messageId,
                        },
                        "当前来源无权限接收本地文件附件，请由主人微信发起。",
                    );
                };
                api.logger.info(`[WeChat Debug] DELIVER ARGS: ${args.length}, TYPES: ${args.map(a => typeof a)}`);
                
                // OpenClaw dispatcher arguments order: (payload, info)
                const payload = (typeof args[0] === 'object' && args[0] !== null) ? args[0] : {};
                const info = (args.length > 1 && typeof args[1] === 'object') ? args[1] : {};
                
                const payloadKeys = Object.keys(payload);
                const payloadPreviews = payloadKeys.map(k => {
                    const val = payload[k];
                    const str = typeof val === 'string' ? val : JSON.stringify(val);
                    return `${k}=(${(str || '').substring(0, 40)}${(str || '').length > 40 ? '...' : ''})`;
                });

                const textFromArg0 = (typeof args[0] === 'string' ? args[0] : "");
                
                // Track all text seen in this specific turn across all dispatcher calls
                // Read-only here, updates belong to onPartialReply
                let currentIncomingText = textFromArg0 || payload.text || payload.message || payload.content || payload.answer || payload.stdout || payload.result || payload.output || payload.data || "";
                if (typeof currentIncomingText === 'string') {
                    currentIncomingText = currentIncomingText.replace(/^(?:MEDIA|FILE):?\s*$/gmi, "").trim();
                }
                
                if (!currentIncomingText && Array.isArray(payload.blocks)) {
                    let combined = "";
                    for (const b of payload.blocks) {
                        let bTxt = typeof b === "string" ? b : (b.text || b.content || "");
                        bTxt = bTxt.trim();
                        // Ignore pure placeholder text inserted by OpenClaw/Dify that breaks deduplication
                        if (!bTxt || bTxt === "MEDIA" || bTxt === "FILE") continue;
                        combined = mergeOverlappingStrings(combined, bTxt);
                    }
                    currentIncomingText = combined;
                }
                
                if (currentIncomingText) {
                    turnTextSeen = mergeOverlappingStrings(turnTextSeen, currentIncomingText);
                }

                api.logger.info(
                    `[WeChat Debug] Kind=${info.kind || 'unknown'}, ` +
                    `SeenLen=${turnTextSeen.length}, ` +
                    `Payload: ${payloadPreviews.join(" | ")}`
                );

                const rawFullText = turnTextSeen;
                const fullTextResult = collapseRepeatedReplyText(rawFullText);
                const fullText = fullTextResult.text;
                if (fullTextResult.mode !== "none") {
                    api.logger.info(
                        `[WeChat] Collapsed duplicated reply text stage=full mode=${fullTextResult.mode} ` +
                        `from=${fullTextResult.originalLength} to=${fullTextResult.collapsedLength}` +
                        `${fullTextResult.repeatCount ? ` repeats=${fullTextResult.repeatCount}` : ""}` +
                        `${fullTextResult.unitLength ? ` unit=${fullTextResult.unitLength}` : ""}` +
                        `${fullTextResult.leftoverLength !== undefined ? ` leftover=${fullTextResult.leftoverLength}` : ""}`,
                    );
                }
                if (fullText.toUpperCase().includes("NO_REPLY")) {
                    api.logger.info(`[WeChat] Skipping reply due to NO_REPLY signal detected`);
                    return;
                }
                const internalFullReply = isWechatInternalStatusReply(fullText);
                if (internalFullReply.matched) {
                    api.logger.info(
                        `[WeChat] Skipping internal reply stage=full reason=${internalFullReply.reason} text="${summarizeWechatTextForLog(redactWechatTextForLogs(fullText, bridgeConfig), 160)}"`,
                    );
                    return;
                }
                const blockedReply = typeof sessionKey === "string"
                    ? getWechatBlockedReplyForSession(sessionKey)
                    : undefined;
                if (blockedReply?.noticeSent) {
                    api.logger.info(
                        `[WeChat] Not suppressing reply after tool-auth block sessionKey=${blockedReply.sessionKey} ` +
                        `reason=${blockedReply.reason || "unknown"} tool=${blockedReply.toolName || ""}`,
                    );
                    // Let the model's natural response through
                }

                // Deduplication logic:
                // 1. Identify new text relative to what we've already sent in this turn.
                // 2. Identify new media URLs.
                let newText = fullText;
                if (cumulativeSentText && fullText.startsWith(cumulativeSentText)) {
                    newText = fullText.substring(cumulativeSentText.length);
                } else if (cumulativeSentText && !fullText.startsWith(cumulativeSentText)) {
                    // Safety fallback: if they drifted, try to find current end
                    const lastSentIndex = fullText.lastIndexOf(cumulativeSentText);
                    if (lastSentIndex !== -1) {
                         newText = fullText.substring(lastSentIndex + cumulativeSentText.length);
                    }
                }

                const newTextResult = collapseRepeatedReplyText(newText);
                newText = newTextResult.text;
                if (newTextResult.mode !== "none") {
                    api.logger.info(
                        `[WeChat] Collapsed duplicated reply text stage=incremental mode=${newTextResult.mode} ` +
                        `from=${newTextResult.originalLength} to=${newTextResult.collapsedLength}` +
                        `${newTextResult.repeatCount ? ` repeats=${newTextResult.repeatCount}` : ""}` +
                        `${newTextResult.unitLength ? ` unit=${newTextResult.unitLength}` : ""}` +
                        `${newTextResult.leftoverLength !== undefined ? ` leftover=${newTextResult.leftoverLength}` : ""}`,
                    );
                }
                const internalIncrementalReply = isWechatInternalStatusReply(newText);
                if (internalIncrementalReply.matched) {
                    api.logger.info(
                        `[WeChat] Skipping internal reply stage=incremental reason=${internalIncrementalReply.reason} text="${summarizeWechatTextForLog(redactWechatTextForLogs(newText, bridgeConfig), 160)}"`,
                    );
                    return;
                }
                const redundantToolFailureSummary = shouldSuppressWechatToolFailureSummary({
                    payload,
                    text: newText,
                    cumulativeSentText,
                });
                if (redundantToolFailureSummary.matched) {
                    api.logger.info(
                        `[WeChat] Skipping redundant tool failure summary stage=incremental reason=${redundantToolFailureSummary.reason} text="${summarizeWechatTextForLog(redactWechatTextForLogs(newText, bridgeConfig), 160)}"`,
                    );
                    return;
                }

                const extractedBareMedia = extractWechatBareLocalMediaFromText({
                    text: newText,
                    workspaceBase: bridgeConfig.workspaceBase,
                });
                let textToProcess = rewriteWechatNonOwnerAddressing(extractedBareMedia.text, {
                    isMaster,
                    senderName: resolvedSenderName,
                });
                if (sentMediaKeys.size > 0 && textToProcess) {
                    const sanitizedText = stripFalseWechatMediaFailureSuffix(textToProcess);
                    if (sanitizedText.stripped) {
                        api.logger.info(
                            `[WeChat] Suppressed false media failure suffix after successful media send stage=${info.kind}`,
                        );
                        textToProcess = sanitizedText.text;
                    }
                }
                
                // [Crucial Check] If we already sent this exact line, skip it
                // Normalize whitespace before comparison to catch block vs final formatting differences
                const normalizeWs = (s: string) => s.replace(/\s+/g, " ").trim();
                if (textToProcess.trim() && normalizeWs(cumulativeSentText).includes(normalizeWs(textToProcess))) {
                    api.logger.info(`[WeChat] Skipping redundant ${info.kind} text (ws-normalized match): "${textToProcess.trim().substring(0, 30)}..."`);
                    textToProcess = ""; 
                }

                const rawMedia = [...(payload.mediaUrls || []), ...extractedBareMedia.mediaPaths];
                if (payload.mediaUrl && !rawMedia.includes(payload.mediaUrl)) rawMedia.push(payload.mediaUrl);
                const existingMedia = filterWechatExistingMediaCandidates({
                    mediaUrls: rawMedia,
                    logger: api.logger,
                    resolveDedupKey: resolveMediaDedupKey,
                });
                const allMedia: WechatMediaCandidate[] = [];
                for (const mediaCandidate of existingMedia) {
                    const deliveryDecision = shouldBlockWechatLocalAttachmentDelivery({
                        mediaUrl: mediaCandidate.mediaUrl,
                        authContext: replyAuthContext,
                        config: bridgeConfig,
                    });
                    if (deliveryDecision.blocked) {
                        api.logger.warn(
                            `[WeChat ToolAuth] Blocking outbound local attachment delivery to ${from} (${chatType}) ` +
                            `sender=${resolvedSenderId} path="${summarizeWechatTextForLog(deliveryDecision.absolutePath || mediaCandidate.mediaUrl, 180)}" ` +
                            `reason=${deliveryDecision.reason || "unknown"}`,
                        );
                        await notifyBlockedLocalAttachment();
                        continue;
                    }
                    allMedia.push(mediaCandidate);
                }
                for (const derivedMediaPath of extractedBareMedia.mediaPaths) {
                    if (!payload.mediaUrl && !(payload.mediaUrls || []).includes(derivedMediaPath)) {
                        api.logger.info(
                            `[WeChat] Promoted bare local file path to media delivery path="${summarizeWechatTextForLog(derivedMediaPath, 180)}"`,
                        );
                    }
                }
                
                const hasNewMedia = allMedia.some(
                    (candidate) =>
                        !sentMediaKeys.has(candidate.dedupKey) &&
                        !isRecentlySentReplyMedia(candidate.dedupKey),
                );
                const isMediaOnlyBlock = info.kind === "block" && !textToProcess && hasNewMedia;
                if (isMediaOnlyBlock) {
                    const unsentMedia = allMedia.filter(
                        (candidate, index, list) =>
                            !sentMediaKeys.has(candidate.dedupKey) &&
                            !isRecentlySentReplyMedia(candidate.dedupKey) &&
                            list.findIndex((item) => item.dedupKey === candidate.dedupKey) === index &&
                            !pendingBlockMediaPaths.some((item) => item.dedupKey === candidate.dedupKey),
                    );
                    if (unsentMedia.length) {
                        pendingBlockMediaPaths.push(...unsentMedia);
                        schedulePendingBlockMediaFlush();
                        api.logger.info(
                            `[WeChat] Buffered media-only block count=${unsentMedia.length} waitMs=${pendingBlockMediaDelayMs}`,
                        );
                        return;
                    }
                }

                if (textToProcess && pendingBlockMediaPaths.length) {
                    const pendingMediaToMerge = takePendingBlockMediaPaths();
                    if (pendingMediaToMerge.length) {
                        api.logger.info(
                            `[WeChat] Merging buffered media-only block into text reply count=${pendingMediaToMerge.length} kind=${info.kind || "unknown"}`,
                        );
                        for (const pendingMedia of pendingMediaToMerge) {
                            if (!allMedia.some((item) => item.dedupKey === pendingMedia.dedupKey)) {
                                allMedia.push(pendingMedia);
                            }
                        }
                    }
                }
                
                // Regex-based media parsing also contributes to sentMediaKeys
                // We'll process the full text if it's the first time, 
                // or just the newText if it's incremental.
                if (!textToProcess && !hasNewMedia) {
                    api.logger.info(
                        `[WeChat] Skipping redundant ${info.kind} reply (no new text/media)`,
                    );
                    return;
                }

                const logText = redactWechatTextForLogs(textToProcess, bridgeConfig).substring(0, 50).replace(/\n/g, "\\n");
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
                            original_msg_id: upstreamMessageTraceId,
                            accountId: accountId || "default",
                            cfg,
                        } as any);
                    }
                    const mPath = match[1];
                    const mPathDedupKey = mPath ? resolveMediaDedupKey(mPath) : "";
                    if (
                        mPath &&
                        !sentMediaKeys.has(mPathDedupKey) &&
                        !isRecentlySentReplyMedia(mPathDedupKey)
                    ) {
                        const deliveryDecision = shouldBlockWechatLocalAttachmentDelivery({
                            mediaUrl: mPath,
                            authContext: replyAuthContext,
                            config: bridgeConfig,
                        });
                        if (deliveryDecision.blocked) {
                            api.logger.warn(
                                `[WeChat ToolAuth] Blocking inline local attachment delivery to ${from} (${chatType}) ` +
                                `sender=${resolvedSenderId} path="${summarizeWechatTextForLog(deliveryDecision.absolutePath || mPath, 180)}" ` +
                                `reason=${deliveryDecision.reason || "unknown"}`,
                            );
                            await notifyBlockedLocalAttachment();
                            cursor = match.index + match[0].length;
                            continue;
                        }
                        await sendReplyMediaCandidate(
                            {
                                mediaUrl: mPath,
                                dedupKey: mPathDedupKey,
                            },
                            "inline-directive",
                        );
                    }
                    cursor = match.index + match[0].length;
                }

                const remainingText = textToProcess.substring(cursor).trim();
                if (remainingText && wechatPlugin.outbound?.sendText) {
                    await wechatPlugin.outbound.sendText({
                        to: from,
                        text: remainingText,
                        msg_id: messageId,
                        original_msg_id: upstreamMessageTraceId,
                        accountId: accountId || "default",
                        cfg,
                    } as any);
                }

                // Process explicit media urls from payload
                for (const mediaCandidate of allMedia) {
                    if (
                        !sentMediaKeys.has(mediaCandidate.dedupKey) &&
                        !isRecentlySentReplyMedia(mediaCandidate.dedupKey)
                    ) {
                        await sendReplyMediaCandidate(mediaCandidate, "payload-media");
                    }
                }

                // Update turn state - ONLY text, NO placeholders
                if (textToProcess) {
                    const textOnly = textToProcess.replace(/(?:MEDIA|FILE):([^\s]+)/g, "").trim();
                    if (textOnly) {
                        cumulativeSentText += (cumulativeSentText ? (textOnly.startsWith("\n") ? "" : "\n") : "") + textOnly;
                    }
                }

            },
        },
        replyOptions: {
            sourceReplyDeliveryMode: "automatic",
            onPartialReply: (payload) => {
                let txt = payload.text || payload.content || payload.message || payload.answer || "";
                if (txt && typeof txt === 'string') {
                    txt = txt.replace(/^(?:MEDIA|FILE):?\s*$/gmi, "").trim();
                    if (txt) {
                        // 使用智能重叠合并，防止 AI 重复输出前缀导致的翻倍
                        turnTextSeen = mergeOverlappingStrings(turnTextSeen, txt);
                    }
                }
            }
        }
    });

    // [Fallback] Flush any remaining buffered media that was never merged into a text reply
    if (pendingBlockMediaPaths.length) {
        await flushPendingBlockMediaPaths("post-dispatch-settle");
    }

    // [Fallback] If deliver was never called (or never sent text), but onPartialReply
    // captured text content, send it now as a final fallback.
    // This handles the scenario where OpenClaw core dispatches media via direct
    // sendMedia calls (e.g. during tool execution) but does not route the final
    // text reply through the deliver callback.
    const unseenText = rewriteWechatNonOwnerAddressing(turnTextSeen.trim(), {
        isMaster,
        senderName: resolvedSenderName,
    });
    const finalUnseenText =
        sentMediaKeys.size > 0 && unseenText
            ? stripFalseWechatMediaFailureSuffix(unseenText).text
            : unseenText;
    if (!cumulativeSentText && finalUnseenText && wechatPlugin.outbound?.sendText) {
        const bridgeConfig = resolveWechatExtensionConfig(cfg, api.logger);
        const internalCheck = isWechatInternalStatusReply(finalUnseenText);
        const hasNoReply = finalUnseenText.toUpperCase().includes("NO_REPLY");
        const blockedReply = typeof sessionKey === "string"
            ? getWechatBlockedReplyForSession(sessionKey)
            : undefined;
        if (!internalCheck.matched && !hasNoReply) {
            api.logger.info(
                `[WeChat] Fallback: deliver never sent text but onPartialReply captured content, sending now ` +
                `session=${sessionKey} textLen=${finalUnseenText.length} text="${summarizeWechatTextForLog(finalUnseenText, 120)}"`,
            );
            await wechatPlugin.outbound.sendText({
                to: from,
                text: finalUnseenText,
                msg_id: messageId,
                original_msg_id: upstreamMessageTraceId,
                accountId: accountId || "default",
                cfg,
            } as any);
            cumulativeSentText = finalUnseenText;
        }
    }

    api.logger.info(
        `[WeChat Debug] Dispatch settled session=${sessionKey} trace=${replyMediaDispatchId} queuedFinal=${dispatchResult?.queuedFinal ? "true" : "false"} ` +
        `counts=${JSON.stringify(dispatchResult?.counts || {})} cumulativeTextLen=${cumulativeSentText.length} ` +
        `sentMedia=${sentMediaKeys.size} pendingMedia=${pendingBlockMediaPaths.length}`,
    );
}


const plugin = {
    id: "wechat",
    name: "WeChat",
    description: "WeChat channel plugin (WS bridge)",
    configSchema: emptyPluginConfigSchema(),
    register(api: OpenClawPluginApi) {
        try {
            api.logger.debug(`[WeChat] Registering plugin package... (PID: ${process.pid})`);
            const sharedState = getGlobalState();
            if (sharedState.registering) {
                setWechatRuntime(api.runtime);
                sharedState.runtime = api.runtime;
                bindApiHandlers();
                sharedState.duplicateRegisterCount = (sharedState.duplicateRegisterCount || 0) + 1;
                if (sharedState.duplicateRegisterCount === 1) {
                    api.logger.debug(
                        "[WeChat] Plugin register re-entered while initial registration is still in progress; suppressing duplicate call.",
                    );
                }
                return;
            }
            if (sharedState.registered) {
                setWechatRuntime(api.runtime);
                sharedState.runtime = api.runtime;
                syncModuleRefsFromState(sharedState);
                bindApiHandlers();
                sharedState.duplicateRegisterCount = (sharedState.duplicateRegisterCount || 0) + 1;
                if (sharedState.duplicateRegisterCount === 1) {
                    api.logger.debug?.(
                        "[WeChat] Plugin register called again in the same process; skipping duplicate registration.",
                    );
                    logBridgeState(api, "register:duplicate", sharedState);
                } else if (sharedState.duplicateRegisterCount % 100 === 0) {
                    api.logger.debug(
                        `[WeChat] Duplicate plugin register suppressed count=${sharedState.duplicateRegisterCount}.`,
                    );
                }

                if (!sharedState.closing && !sharedState.startPromise && !hasActiveBridgeClient(sharedState)) {
                    const now = Date.now();
                    const shouldAttemptRecovery =
                        !sharedState.lastRecoveryAttemptAt ||
                        now - sharedState.lastRecoveryAttemptAt >= DUPLICATE_REGISTER_RECOVERY_COOLDOWN_MS;
                    if (shouldAttemptRecovery) {
                        sharedState.lastRecoveryAttemptAt = now;
                        if (
                            !sharedState.lastRecoveryLogAt ||
                            now - sharedState.lastRecoveryLogAt >= DUPLICATE_REGISTER_RECOVERY_LOG_INTERVAL_MS
                        ) {
                            sharedState.lastRecoveryLogAt = now;
                            api.logger.info(
                                "[WeChat] Duplicate register detected while bridge is offline; attempting recovery.",
                            );
                        }
                        maybeTriggerWechatBridgeStart(api, "duplicate-register recovery");
                    }
                }
                return;
            }
            sharedState.registering = true;
            sharedState.registered = true;
            sharedState.duplicateRegisterCount = 0;
            sharedState.lastDuplicateRegisterLogAt = 0;
            sharedState.lastRecoveryAttemptAt = 0;
            sharedState.lastRecoveryLogAt = 0;
            setWechatRuntime(api.runtime);

            bindApiHandlers();

            maybeTriggerWechatBridgeStart(api, "plugin register");
            sharedState.registering = false;

            api.logger.debug("[WeChat] Registration complete.");
        } catch (err: any) {
            const sharedState = getGlobalState();
            sharedState.registering = false;
            sharedState.registered = false;
            api.logger.error(`[WeChat] Registration error: ${err.message}`);
        }

        function bindApiHandlers() {
            if (!markWechatApiBound(api)) {
                return;
            }
            const sharedState = getGlobalState();

            const tryBindWechatToolAuthForRun = (params: {
                ctx: Record<string, unknown> | undefined;
                hookName: string;
                runId?: string;
            }) => {
                const sessionKey = resolveWechatContextSessionKey(params.ctx);
                const runId = params.runId?.trim() ||
                    (typeof params.ctx?.runId === "string" && params.ctx.runId.trim() ? params.ctx.runId.trim() : "");
                if (!runId || !sessionKey) {
                    return;
                }

                const existingRunAuth = getWechatToolAuthForRun(runId);
                if (existingRunAuth) {
                    return existingRunAuth;
                }

                const boundAuth = bindWechatToolAuthToRun({
                    sessionKey,
                    runId,
                });
                if (boundAuth) {
                    api.logger.debug?.(
                        `[WeChat ToolAuth] Bound auth to run via ${params.hookName} ${summarizeWechatToolAuthDebugState({
                            sessionKey,
                            runId,
                        })}`,
                    );
                    return boundAuth;
                }

                if (shouldApplyWechatToolAuth({ sessionKey, runId })) {
                    const existingSessionAuth = getWechatToolAuthForSession(sessionKey);
                    const debugState = summarizeWechatToolAuthDebugState({
                        sessionKey,
                        runId,
                    });
                    if (existingSessionAuth) {
                        api.logger.debug?.(
                            `[WeChat ToolAuth] Bind to run skipped via ${params.hookName} because auth context is already available source=session ${debugState}`,
                        );
                    } else {
                        api.logger.debug?.(
                            `[WeChat ToolAuth] Failed to bind auth to run via ${params.hookName} ${debugState}`,
                        );
                    }
                }

                return;
            };

            api.on("before_dispatch", (event, ctx) => {
                const sessionKey = resolveWechatContextSessionKey(ctx as Record<string, unknown>);
                if (!shouldApplyWechatToolAuth({ sessionKey })) {
                    return;
                }

                const promotedAuth = promoteWechatToolAuthForDispatch({
                    sessionKey: sessionKey!,
                    senderId: resolveWechatContextSenderId(ctx as Record<string, unknown>, event.senderId),
                    content: resolveWechatContextBody(ctx as Record<string, unknown>, event.body || event.content),
                });
                if (!promotedAuth) {
                    const dispatchSenderId = resolveWechatContextSenderId(ctx as Record<string, unknown>, event.senderId) || "";
                    api.logger.warn?.(
                        `[WeChat ToolAuth] No pending auth matched during dispatch ${summarizeWechatToolAuthDebugState({
                            sessionKey,
                        })} senderId=${dispatchSenderId}`,
                    );
                }

                return;
            }, { priority: 100 });

            api.on("before_model_resolve", (_event, ctx) => {
                tryBindWechatToolAuthForRun({
                    ctx: ctx as Record<string, unknown>,
                    hookName: "before_model_resolve",
                });
                return;
            }, { priority: 100 });

            api.on("before_prompt_build", (_event, ctx) => {
                tryBindWechatToolAuthForRun({
                    ctx: ctx as Record<string, unknown>,
                    hookName: "before_prompt_build",
                });
                return;
            }, { priority: 100 });

            api.on("before_agent_start", (_event, ctx) => {
                tryBindWechatToolAuthForRun({
                    ctx: ctx as Record<string, unknown>,
                    hookName: "before_agent_start",
                    runId: ctx.runId,
                });
                return;
            }, { priority: 100 });

            api.on("before_tool_call", (event, ctx) => {
                const cfg = api.runtime.config.current();
                const bridgeConfig = resolveWechatExtensionConfig(cfg, api.logger);
                const guardedTools = normalizeGuardedToolNameList(bridgeConfig.nonOwnerToolAuthTools);
                const bypassWxids = normalizeWechatIdAllowList(bridgeConfig.toolAuthBypassWxids);
                const blockedSkills = normalizeWechatSkillIdList(bridgeConfig.toolAuthBlockedSkills);
                const toolName = event.toolName.trim().toLowerCase();
                const toolSpecificBypassWxids = getWechatToolSpecificAllowList(bridgeConfig, toolName);
                const effectiveRunId = ctx.runId?.trim() || event.runId?.trim();
                const effectiveSessionKey = resolveWechatContextSessionKey(ctx as Record<string, unknown>);

                // [Auto-inject channel] 当 AI 在 WeChat 会话中调用 message 工具但未指定 channel 时，
                // 自动注入 channel: "wechat"，防止多渠道配置下的 "Channel is required" 错误。
                if (
                    toolName === "message" &&
                    effectiveSessionKey &&
                    effectiveSessionKey.includes(":wechat:") &&
                    event.params &&
                    typeof event.params === "object" &&
                    !((event.params as any).channel)
                ) {
                    api.logger.info(
                        `[WeChat] Auto-injecting channel=wechat for message tool call session=${effectiveSessionKey}`,
                    );
                    return {
                        params: {
                            ...event.params,
                            channel: "wechat",
                        },
                    };
                }

                if (!shouldApplyWechatToolAuth({
                    sessionKey: effectiveSessionKey,
                    runId: effectiveRunId,
                })) {
                    return;
                }
                let runBoundAuth = effectiveRunId ? getWechatToolAuthForRun(effectiveRunId) : undefined;
                let sessionBoundAuth = effectiveSessionKey ? getWechatToolAuthForSession(effectiveSessionKey) : undefined;
                if (!runBoundAuth && !sessionBoundAuth && effectiveRunId && effectiveSessionKey) {
                    runBoundAuth = tryBindWechatToolAuthForRun({
                        ctx: ctx as Record<string, unknown>,
                        hookName: "before_tool_call",
                        runId: effectiveRunId,
                    });
                    sessionBoundAuth = effectiveSessionKey ? getWechatToolAuthForSession(effectiveSessionKey) : undefined;
                }
                let authContext = runBoundAuth ?? sessionBoundAuth;
                let authContextSource: "run" | "session" | "chat" | undefined =
                    runBoundAuth ? "run" : (sessionBoundAuth ? "session" : undefined);
                if (!authContext && effectiveSessionKey) {
                    const fallbackAuthContext = getWechatToolAuthFallbackForSession(effectiveSessionKey);
                    if (fallbackAuthContext) {
                        authContext = fallbackAuthContext;
                        authContextSource = "chat";
                        api.logger.warn?.(
                            `[WeChat ToolAuth] Recovered auth context via chat fallback tool=${toolName} sessionKey=${effectiveSessionKey} runId=${effectiveRunId || ""} ` +
                            `${summarizeWechatToolAuthRecord(fallbackAuthContext)}`,
                        );
                    }
                }
                const paramsSummary = summarizeWechatToolParamsForLog(
                    toolName,
                    isWechatLogRecord(event.params) ? event.params : undefined,
                );

                if (toolName === "web_fetch" && authContext) {
                    api.logger.info(
                        `[WeChat ToolTrace] tool=${toolName} phase=before runId=${effectiveRunId || ""} ${paramsSummary} ${summarizeWechatToolAuthRecord(authContext)}`,
                    );
                }

                if (guardedTools.has(toolName) && !effectiveRunId) {
                    api.logger.warn?.(
                        `[WeChat ToolAuth] Guarded tool missing runId tool=${toolName} ${summarizeWechatToolAuthDebugState({
                            sessionKey: effectiveSessionKey,
                            runId: event.runId,
                        })}`,
                    );
                }

                if (guardedTools.has(toolName) && authContext && authContextSource !== "run") {
                    api.logger.warn?.(
                        `[WeChat ToolAuth] Guarded tool using ${authContextSource || "unknown"} fallback tool=${toolName} sessionKey=${effectiveSessionKey || ""} runId=${effectiveRunId || ""}`,
                    );
                }

                if (!guardedTools.has(toolName)) {
                    return;
                }

                // [System-safe path bypass] Allow write/read to internal system paths
                // regardless of sender authorization. These are typically triggered by
                // OpenClaw's compaction/memory flush/dreaming/bootstrap, not by user actions.
                // Without this, the auth system incorrectly attributes system tasks to
                // the last group chat sender and blocks legitimate maintenance operations.
                //
                // Covered paths:
                //   memory/          – daily memory logs (compaction memoryFlush)
                //   MEMORY.md        – persistent memory (AI self-management)
                //   DREAMS.md        – dreaming plugin output
                //   AGENTS.md        – agent reference (bootstrap)
                //   SOUL.md          – agent personality (bootstrap)
                //   TOOLS.md         – tools reference (bootstrap)
                //   BOOT.md          – boot hook output
                if (toolName === "write" || toolName === "read") {
                    const targetPath = String((event.params as any)?.path || "").trim().replace(/\\/g, "/");
                    const systemSafePrefixes = ["memory/", "memory"];
                    const systemSafeFiles = [
                        "MEMORY.md", "DREAMS.md", "AGENTS.md",
                        "SOUL.md", "TOOLS.md", "BOOT.md",
                    ];
                    const isSystemSafe =
                        systemSafePrefixes.some((p) => targetPath === p || targetPath.startsWith(p + (p.endsWith("/") ? "" : "/"))) ||
                        systemSafeFiles.some((f) => targetPath === f || targetPath.endsWith("/" + f));
                    if (isSystemSafe) {
                        api.logger.info(
                            `[WeChat ToolAuth] System-safe path bypass tool=${toolName} path="${targetPath}" session=${effectiveSessionKey || ""}`,
                        );
                        return;
                    }
                }

                if (!authContext) {
                    const debugSummary = summarizeWechatToolAuthDebugState({
                        sessionKey: effectiveSessionKey,
                        runId: effectiveRunId,
                    });
                    if (claimWechatToolAuthLogDedup({
                        kind: "missing-auth-context",
                        runId: effectiveRunId,
                        toolName,
                        detail: debugSummary,
                    })) {
                        api.logger.error?.(
                            `[WeChat ToolAuth] Blocking guarded tool because auth context is missing tool=${toolName} ${debugSummary}`,
                        );
                    }

                    if (bridgeConfig.nonOwnerToolAuthMode === "off") {
                        return;
                    }

                    const recordedFallbackAuth = effectiveSessionKey
                        ? getWechatToolAuthFallbackForSession(effectiveSessionKey)
                        : undefined;
                    const fallbackNoticeContext = recordedFallbackAuth
                        ? resolveWechatFallbackNoticeContextFromSessionKey(effectiveSessionKey)
                        : null;
                    const sentBlockedNotice = Boolean(
                        fallbackNoticeContext && shouldSendWechatToolAuthNotice(bridgeConfig, {
                            state: "blocked",
                            chatType: fallbackNoticeContext.chatType,
                        }),
                    );
                    if (fallbackNoticeContext && sentBlockedNotice) {
                        void sendWechatToolAuthNotice(
                            api,
                            fallbackNoticeContext,
                            buildWechatToolNoticeText({
                                toolName,
                                state: "blocked",
                                authContext: fallbackNoticeContext,
                                config: bridgeConfig,
                            }),
                        );
                    } else if (!fallbackNoticeContext) {
                        const missingNoticeDetail = recordedFallbackAuth
                            ? effectiveSessionKey || ""
                            : `${effectiveSessionKey || ""}|synthetic-suppressed`;
                        if (claimWechatToolAuthLogDedup({
                            kind: "missing-auth-context-no-notice-context",
                            runId: effectiveRunId,
                            toolName,
                            detail: missingNoticeDetail,
                        })) {
                            api.logger.warn?.(
                                recordedFallbackAuth
                                    ? `[WeChat ToolAuth] Missing auth context and could not resolve fallback notice context tool=${toolName} sessionKey=${effectiveSessionKey || ""} runId=${effectiveRunId || ""}`
                                    : `[WeChat ToolAuth] Missing auth context for guarded tool; suppressing synthetic fallback notice tool=${toolName} sessionKey=${effectiveSessionKey || ""} runId=${effectiveRunId || ""}`,
                            );
                        }
                    }

                    if (effectiveSessionKey) {
                        markWechatBlockedReplyForSession({
                            sessionKey: effectiveSessionKey,
                            toolName,
                            reason: "missing-auth-context",
                            noticeSent: sentBlockedNotice,
                        });
                    }

                    return {
                        block: true,
                        blockReason: `WeChat tool auth context missing for guarded tool ${toolName}; refusing to continue. Please politely inform the user that execution cannot proceed.`,
                    };
                }

                const authSummary = summarizeWechatToolAuthRecord(authContext);
                const allowBypassForAuthContext = authContext.isMaster || authContextSource === "run";
                const generalBypassMatch = allowBypassForAuthContext
                    ? resolveWechatToolBypassMatch(bypassWxids, authContext)
                    : { matched: false };
                const toolSpecificBypassMatch = allowBypassForAuthContext
                    ? resolveWechatToolBypassMatch(toolSpecificBypassWxids, authContext)
                    : { matched: false };
                const bypassMatch = generalBypassMatch.matched ? generalBypassMatch : toolSpecificBypassMatch;
                const bypassSource = generalBypassMatch.matched
                    ? "whitelist-global"
                    : (toolSpecificBypassMatch.matched ? `whitelist-tool:${toolName}` : undefined);
                const isBypassWxid = bypassMatch.matched;
                const execCommand =
                    toolName === "exec" && typeof event.params?.command === "string"
                        ? event.params.command
                        : undefined;
                const execWorkdir =
                    toolName === "exec" && typeof event.params?.workdir === "string"
                        ? event.params.workdir
                        : undefined;
                const processSessionId =
                    toolName === "process" && typeof event.params?.sessionId === "string"
                        ? event.params.sessionId
                        : undefined;
                const shouldInspectInstalledSkill =
                    toolName === "exec" &&
                    typeof execCommand === "string" &&
                    (
                        bridgeConfig.toolAuthAllowInstalledSkills ||
                        bridgeConfig.toolAuthDebugInstalledSkills ||
                        blockedSkills.size > 0
                    );
                const installedSkillMatch =
                    shouldInspectInstalledSkill
                        ? resolveWechatInstalledSkillCommandMatch(
                            execCommand!,
                            execWorkdir,
                            bridgeConfig,
                        )
                        : { matched: false };
                const installedSkillProcessSession =
                    processSessionId
                        ? getWechatSkillToolSession(processSessionId)
                        : undefined;
                const isInstalledSkillProcessSession =
                    toolName === "process" &&
                    bridgeConfig.toolAuthAllowInstalledSkills &&
                    Boolean(processSessionId) &&
                    Boolean(installedSkillProcessSession);
                const isInstalledSkillBypass =
                    bridgeConfig.toolAuthAllowInstalledSkills &&
                    (installedSkillMatch.matched || isInstalledSkillProcessSession);
                const matchedSkillId =
                    (installedSkillMatch.skillId || installedSkillProcessSession?.skillId || "").trim().toLowerCase();
                const blockedSkillId =
                    matchedSkillId && blockedSkills.has(matchedSkillId)
                        ? matchedSkillId
                        : undefined;
                const installedSkillSummary = installedSkillMatch.matched
                    ? summarizeWechatInstalledSkillMatch(installedSkillMatch)
                    : (
                        isInstalledSkillProcessSession && processSessionId
                            ? `reason=process-session sessionId=${processSessionId}${installedSkillProcessSession?.skillId ? ` skill=${installedSkillProcessSession.skillId}` : ""}`
                            : ""
                    );

                if (
                    bridgeConfig.toolAuthDebugInstalledSkills &&
                    shouldInspectInstalledSkill &&
                    !installedSkillMatch.matched
                ) {
                    const debugSummary = buildWechatInstalledSkillDebugSummary(
                        execCommand!,
                        execWorkdir,
                        bridgeConfig,
                    );
                    if (claimWechatToolAuthLogDedup({
                        kind: "installed-skill-debug",
                        runId: effectiveRunId,
                        toolName,
                        detail: debugSummary,
                    })) {
                        api.logger.info(
                            `[WeChat ToolAuth] Installed-skill debug tool=${toolName} runId=${ctx.runId} ${debugSummary} ${authSummary}`,
                        );
                    }
                }

                if (
                    bridgeConfig.toolAuthDebugInstalledSkills &&
                    toolName === "process" &&
                    bridgeConfig.toolAuthAllowInstalledSkills &&
                    processSessionId &&
                    !isInstalledSkillProcessSession
                ) {
                    const debugSummary = `reason=unknown-process-session sessionId=${processSessionId}`;
                    if (claimWechatToolAuthLogDedup({
                        kind: "installed-skill-debug",
                        runId: effectiveRunId,
                        toolName,
                        detail: debugSummary,
                    })) {
                        api.logger.info(
                            `[WeChat ToolAuth] Installed-skill debug tool=${toolName} runId=${ctx.runId} ${debugSummary} ${authSummary}`,
                        );
                    }
                }

                if (!authContext.isMaster && !isBypassWxid && blockedSkillId) {
                    if (claimWechatToolAuthLogDedup({
                        kind: "blocked-blacklisted-skill",
                        runId: effectiveRunId,
                        toolName,
                        skillId: blockedSkillId,
                        detail: installedSkillSummary,
                    })) {
                        api.logger.warn(
                            `[WeChat ToolAuth] Blocked blacklisted skill tool=${toolName} runId=${effectiveRunId || ""} skill=${blockedSkillId}${installedSkillSummary ? ` ${installedSkillSummary}` : ""} ${authSummary}`,
                        );
                    }
                    const sentBlockedNotice = shouldSendWechatToolAuthNotice(bridgeConfig, {
                        state: "blocked",
                        chatType: authContext.chatType,
                    });
                    if (sentBlockedNotice) {
                        void sendWechatToolAuthNotice(
                            api,
                            {
                                ...authContext,
                                skillId: blockedSkillId,
                            },
                            buildWechatToolNoticeText({
                                toolName,
                                state: "blocked",
                                authContext: {
                                    ...authContext,
                                    skillId: blockedSkillId,
                                },
                                config: bridgeConfig,
                            }),
                        );
                    }
                    if (effectiveSessionKey) {
                        markWechatBlockedReplyForSession({
                            sessionKey: effectiveSessionKey,
                            toolName,
                            reason: "blocked-skill",
                            noticeSent: sentBlockedNotice,
                        });
                    }
                    return {
                        block: true,
                        blockReason: `WeChat sender ${authContext.senderId || "unknown"} is not authorized to use blocked skill ${blockedSkillId} via ${toolName}. Please politely inform the user that they do not have permission.`,
                    };
                }

                if (authContext.isMaster || isBypassWxid || isInstalledSkillBypass) {
                    if (
                        toolName === "exec" &&
                        (bridgeConfig.ownerExecBypassApproval || isInstalledSkillBypass) &&
                        event.params &&
                        typeof event.params === "object"
                    ) {
                        api.logger.info(
                            `[WeChat ToolAuth] Trusted bypass tool=${toolName} runId=${effectiveRunId || ""} source=${
                                authContext.isMaster
                                    ? "master"
                                    : isInstalledSkillBypass
                                        ? `installed-skill:${isInstalledSkillProcessSession ? "process-session" : (installedSkillMatch.reason || "matched")}`
                                        : `${bypassSource || "whitelist"}:${bypassMatch.kind || "unknown"}`
                            }${installedSkillSummary ? ` ${installedSkillSummary}` : ""} ${authSummary}`,
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
                            `[WeChat ToolAuth] Whitelist bypass tool=${toolName} runId=${effectiveRunId || ""} source=${bypassSource || "whitelist"} matchedBy=${bypassMatch.kind || "unknown"} value=${bypassMatch.value || ""} ${authSummary}`,
                        );
                    }
                    if (isInstalledSkillBypass) {
                        api.logger.info(
                            `[WeChat ToolAuth] Installed-skill bypass tool=${toolName} runId=${effectiveRunId || ""}${installedSkillSummary ? ` ${installedSkillSummary}` : ""} ${authSummary}`,
                        );
                    }
                    return;
                }

                // [Safe-download bypass] Allow exec commands that ONLY contain curl/wget
                // downloading files to the workspace directory. This commonly occurs after
                // image generation skills (doubao-image, gpt-image-2) produce CDN URLs
                // that the AI then downloads with curl. Since curl is not in any skill
                // directory, installedSkillMatch fails, but the operation is safe.
                if (toolName === "exec" && execCommand) {
                    const downloadSegments = execCommand.split(/\n/).map((s) => s.trim()).filter(Boolean);
                    const workspaceBase = bridgeConfig.workspaceBase || "/home/rs/.openclaw/workspace";
                    const safeDownloadPattern = /^(?:curl\s+-[oO]|curl\s+.*-[oO]\s|wget\s+-O\s|wget\s+.*-O\s)/;
                    const allSafeDownloads = downloadSegments.length > 0 && downloadSegments.every((seg) => {
                        if (!safeDownloadPattern.test(seg)) return false;
                        // Extract -o/-O target path and verify it's within workspace
                        const outputMatch = seg.match(/-[oO]\s+["']?([^\s"']+)/);
                        return outputMatch && outputMatch[1].startsWith(workspaceBase);
                    });
                    if (allSafeDownloads) {
                        api.logger.info(
                            `[WeChat ToolAuth] Safe-download bypass tool=exec segments=${downloadSegments.length} ` +
                            `target="${summarizeWechatTextForLog(downloadSegments[0], 120)}" ${authSummary}`,
                        );
                        return {
                            params: {
                                ...event.params,
                                ask: "off",
                            },
                        };
                    }
                }

                if (bridgeConfig.nonOwnerToolAuthMode === "deny") {
                    if (claimWechatToolAuthLogDedup({
                        kind: "denied-tool",
                        runId: effectiveRunId,
                        toolName,
                        detail: authContext.chatType || "",
                    })) {
                        api.logger.warn(
                            `[WeChat ToolAuth] Denied tool=${toolName} runId=${effectiveRunId || ""} ${authSummary}`,
                        );
                    }
                    const sentBlockedNotice = shouldSendWechatToolAuthNotice(bridgeConfig, {
                        state: "blocked",
                        chatType: authContext.chatType,
                    });
                    if (sentBlockedNotice) {
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
                    if (effectiveSessionKey) {
                        markWechatBlockedReplyForSession({
                            sessionKey: effectiveSessionKey,
                            toolName,
                            reason: "non-owner-deny",
                            noticeSent: sentBlockedNotice,
                        });
                    }
                    return {
                        block: true,
                        blockReason: `WeChat sender ${authContext.senderId || "unknown"} is not authorized to use ${toolName}. Please politely inform the user that they do not have permission.`,
                    };
                }

                if (bridgeConfig.nonOwnerToolAuthMode === "approve") {
                    api.logger.warn(
                        `[WeChat ToolAuth] Approval required tool=${toolName} runId=${effectiveRunId || ""} ${authSummary}`,
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

            api.on("after_tool_call", (event, ctx) => {
                if (!ctx.runId) {
                    return;
                }

                const toolName = event.toolName.trim().toLowerCase();
                const authContext = getWechatToolAuthForRun(ctx.runId);

                if (toolName === "web_fetch" && authContext) {
                    const paramsSummary = summarizeWechatToolParamsForLog(
                        toolName,
                        isWechatLogRecord(event.params) ? event.params : undefined,
                    );
                    const resultSummary = summarizeWechatToolResultForLog(toolName, event.result, event.error);
                    const durationSummary = typeof event.durationMs === "number" && Number.isFinite(event.durationMs)
                        ? ` durationMs=${Math.max(0, Math.floor(event.durationMs))}`
                        : "";
                    const logger = event.error ? api.logger.warn : api.logger.info;
                    logger?.(
                        `[WeChat ToolTrace] tool=${toolName} phase=after runId=${ctx.runId}${durationSummary} ${paramsSummary} ${resultSummary} ${summarizeWechatToolAuthRecord(authContext)}`,
                    );
                }

                if (toolName !== "exec" || !authContext) {
                    return;
                }

                const cfg = api.runtime.config.current();
                const bridgeConfig = resolveWechatExtensionConfig(cfg, api.logger);
                if (!bridgeConfig.toolAuthAllowInstalledSkills) {
                    return;
                }

                const params = event.params as Record<string, unknown> | undefined;
                const command = typeof params?.command === "string" ? params.command : "";
                const workdir = typeof params?.workdir === "string" ? params.workdir : undefined;
                const installedSkillMatch = command
                    ? resolveWechatInstalledSkillCommandMatch(command, workdir, bridgeConfig)
                    : { matched: false };
                if (!installedSkillMatch.matched) {
                    return;
                }

                const resultDetails = (event.result as any)?.details;
                const skillSessionId =
                    resultDetails?.status === "running" && typeof resultDetails?.sessionId === "string"
                        ? resultDetails.sessionId
                        : undefined;
                if (!skillSessionId) {
                    if (bridgeConfig.toolAuthDebugInstalledSkills) {
                        const debugSummary = `reason=no-process-session-returned ${summarizeWechatInstalledSkillMatch(installedSkillMatch)}`;
                        if (claimWechatToolAuthLogDedup({
                            kind: "installed-skill-debug",
                            runId: ctx.runId,
                            toolName: "exec",
                            skillId: installedSkillMatch.skillId,
                            detail: debugSummary,
                        })) {
                            api.logger.info(
                                `[WeChat ToolAuth] Installed-skill debug tool=exec runId=${ctx.runId} ${debugSummary}`,
                            );
                        }
                    }
                    return;
                }

                rememberWechatSkillToolSession({
                    sessionId: skillSessionId,
                    skillId: installedSkillMatch.skillId,
                    sessionKey: resolveWechatContextSessionKey(ctx as Record<string, unknown>),
                });
                const installedSkillSummary = summarizeWechatInstalledSkillMatch(installedSkillMatch);
                api.logger.info(
                    `[WeChat ToolAuth] Recorded installed-skill process session sessionId=${skillSessionId} runId=${ctx.runId}${installedSkillSummary ? ` ${installedSkillSummary}` : ""}`,
                );
                return;
            }, { priority: 100 });

            api.on("agent_end", (_event, ctx) => {
                if (ctx.runId) {
                    clearWechatToolAuthForRun(ctx.runId);
                }
            }, { priority: 100 });

            api.on("subagent_spawned", (_event, ctx) => {
                const requesterSessionKey = resolveWechatContextSessionKey({
                    sessionKey: ctx.requesterSessionKey,
                    SessionKey: (ctx as Record<string, unknown>).RequesterSessionKey,
                });
                const childSessionKey = resolveWechatContextSessionKey({
                    sessionKey: ctx.childSessionKey,
                    SessionKey: (ctx as Record<string, unknown>).ChildSessionKey,
                });
                if (!childSessionKey || !requesterSessionKey) {
                    return;
                }
                inheritWechatToolAuthForChildSession({
                    requesterSessionKey,
                    childSessionKey,
                });
            }, { priority: 100 });

            api.on("session_end", (_event, ctx) => {
                const sessionKey = resolveWechatContextSessionKey(ctx as Record<string, unknown>);
                if (sessionKey) {
                    clearWechatToolAuthForSession(sessionKey);
                }
            }, { priority: 100 });

            sharedState.runtime = api.runtime;
            syncModuleRefsFromState(sharedState);
            logBridgeState(api, "register:init", sharedState);

            api.registerChannel({ plugin: wechatPlugin });
        }
    },
    unregister(api: OpenClawPluginApi) {
        const state = getGlobalState();
        state.boundApis.delete(api as object);
        state.registering = false;
        state.registered = false;
        state.duplicateRegisterCount = 0;
        state.lastDuplicateRegisterLogAt = 0;
        state.lastRecoveryAttemptAt = 0;
        state.lastRecoveryLogAt = 0;
        logBridgeState(api, "unregister:before");
        void closeBridgeResources(api, "plugin unregister");
    }
};

export default plugin;
