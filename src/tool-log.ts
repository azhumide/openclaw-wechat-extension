import { summarizeWechatTextForLog } from "./text.js";

export function summarizeWechatToolAuthRecord(entry: {
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

export function isWechatLogRecord(value: unknown): value is Record<string, unknown> {
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

export function summarizeWechatToolParamsForLog(
    toolName: string,
    params: Record<string, unknown> | undefined,
): string {
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

export function summarizeWechatToolResultForLog(toolName: string, result: unknown, error?: string): string {
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

export function isWechatInternalStatusReply(text: string): { matched: boolean; reason?: string } {
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

    if (/^(?:⚠️\s*(?:[^\w\s]+\s*)*)?Message\s+failed[.!?]*$/i.test(normalized)) {
        return true;
    }

    return /^⚠️(?:\s*[^\w\s]+\s*)*[A-Za-z][\w-]*:\s*[\s\S]*\bfailed\b[.!?]*$/i.test(normalized);
}

export function shouldSuppressWechatToolFailureSummary(params: {
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
