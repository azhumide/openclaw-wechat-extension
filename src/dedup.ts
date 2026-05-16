import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { wechatPlugin } from "./channel.js";
import { summarizeWechatTextForLog } from "./text.js";

const globalDedupSym = Symbol.for("openclaw.wechat.dedup.state");
const WECHAT_TOOL_NOTICE_DEDUP_TTL_MS = 120_000;
const WECHAT_TOOL_AUTH_LOG_DEDUP_TTL_MS = 120_000;
const WECHAT_REPLY_MEDIA_DEDUP_TTL_MS = 15_000;

type WechatDedupGlobalState = {
    recentToolNoticeAt: Map<string, number>;
    recentToolAuthLogAt: Map<string, number>;
    recentReplyMediaAt: Map<string, number>;
};

function getWechatDedupState(): WechatDedupGlobalState {
    const holder = globalThis as Record<symbol, any>;
    const existing = (holder[globalDedupSym] ??= {});
    if (!(existing.recentToolNoticeAt instanceof Map)) {
        existing.recentToolNoticeAt = new Map<string, number>();
    }
    if (!(existing.recentToolAuthLogAt instanceof Map)) {
        existing.recentToolAuthLogAt = new Map<string, number>();
    }
    if (!(existing.recentReplyMediaAt instanceof Map)) {
        existing.recentReplyMediaAt = new Map<string, number>();
    }
    return existing as WechatDedupGlobalState;
}

function pruneDedupMap(dedupMap: Map<string, number>, ttlMs: number, now = Date.now()): void {
    for (const [key, timestamp] of dedupMap) {
        if (now - timestamp > ttlMs) {
            dedupMap.delete(key);
        }
    }
}

export function claimWechatToolNoticeDedup(params: {
    to: string;
    messageId?: string;
    text: string;
}): boolean {
    const now = Date.now();
    const dedupMap = getWechatDedupState().recentToolNoticeAt;
    pruneDedupMap(dedupMap, WECHAT_TOOL_NOTICE_DEDUP_TTL_MS, now);

    const normalizedText = params.text.replace(/\s+/g, " ").trim();
    const dedupKey = `${params.to}|${params.messageId || ""}|${normalizedText}`;
    const lastSentAt = dedupMap.get(dedupKey);
    if (lastSentAt && now - lastSentAt <= WECHAT_TOOL_NOTICE_DEDUP_TTL_MS) {
        return false;
    }
    dedupMap.set(dedupKey, now);
    return true;
}

export function claimWechatToolAuthLogDedup(params: {
    kind: string;
    runId?: string;
    toolName?: string;
    skillId?: string;
    detail?: string;
}): boolean {
    const now = Date.now();
    const dedupMap = getWechatDedupState().recentToolAuthLogAt;
    pruneDedupMap(dedupMap, WECHAT_TOOL_AUTH_LOG_DEDUP_TTL_MS, now);

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

function pruneWechatReplyMediaDedupMap(now = Date.now()): void {
    pruneDedupMap(
        getWechatDedupState().recentReplyMediaAt,
        WECHAT_REPLY_MEDIA_DEDUP_TTL_MS,
        now,
    );
}

export function buildWechatReplyMediaDedupKey(params: {
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

export function hasRecentWechatReplyMedia(dedupKey: string): boolean {
    const now = Date.now();
    pruneWechatReplyMediaDedupMap(now);
    const seenAt = getWechatDedupState().recentReplyMediaAt.get(dedupKey);
    return typeof seenAt === "number" && now - seenAt <= WECHAT_REPLY_MEDIA_DEDUP_TTL_MS;
}

export function claimWechatReplyMediaDedup(dedupKey: string): boolean {
    const now = Date.now();
    pruneWechatReplyMediaDedupMap(now);
    const dedupMap = getWechatDedupState().recentReplyMediaAt;
    const seenAt = dedupMap.get(dedupKey);
    if (typeof seenAt === "number" && now - seenAt <= WECHAT_REPLY_MEDIA_DEDUP_TTL_MS) {
        return false;
    }
    dedupMap.set(dedupKey, now);
    return true;
}

export function releaseWechatReplyMediaDedup(dedupKey: string): void {
    getWechatDedupState().recentReplyMediaAt.delete(dedupKey);
}

export async function sendWechatToolAuthNotice(api: OpenClawPluginApi, authContext: {
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
