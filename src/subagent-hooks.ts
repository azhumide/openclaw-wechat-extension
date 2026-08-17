import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import {
    canonicalWechatChannelId,
    normalizeWechatSubagentDeliveryOrigin,
} from "./canonicalization.js";
import { wechatPlugin } from "./channel.js";
import { resolveWechatExtensionConfig } from "./config.js";
import { resolveWechatContextSessionKey } from "./message-tool.js";
import {
    clearWechatToolAuthForRun,
    clearWechatToolAuthForSession,
    inheritWechatToolAuthForChildSession,
} from "./runtime.js";
import {
    redactWechatTextForLogs,
    summarizeWechatTextForLog,
} from "./text.js";

const WECHAT_SUBAGENT_COMPLETION_DIRECT_TTL_MS = 10 * 60 * 1000;
const WECHAT_MEDIA_REF_RE = /\.(?:png|jpe?g|webp|gif|bmp|mp4|mov|webm|mp3|wav|ogg|m4a|flac|pdf)(?:[?#].*)?$/i;
const WECHAT_SILENT_REPLY_TOKEN = "NO_REPLY";
const wechatSubagentCompletionDirectClaims = new Map<string, number>();
const wechatSubagentCompletionDirectDeliveredRunIds = new Map<string, number>();
const wechatSubagentCompletionDirectDeliveryRecords = new Map<string, {
    deliveredAt: number;
    target: {
        to: string;
        accountId?: string;
    };
    fallbackText?: string;
    textSentAt?: number;
}>();

const WECHAT_MESSAGE_TOOL_COMPLETION_CONTEXT = [
    "## WeChat Completion Delivery",
    "This WeChat completion/background/subagent route is message-tool-first.",
    "For visible output, call `message(action=\"send\", message=\"...\")`. Do not finish with plain text and do not use `MEDIA:` or `FILE:` lines as the final answer.",
    "For generated files, call `message(action=\"send\", message=\"caption\", filePath=\"/absolute/path/to/file\")`; for multiple files use `attachments:[{filePath:\"/absolute/path\"}]`.",
    "The current WeChat conversation is the default target. Omit `target`/`channel` unless sending elsewhere; if an explicit channel is required, use `channel=\"wechat\"`.",
    "Do not call `exec`, shell commands, or `wechat-tools/query_wechat.py` to discover the current WeChat target; the runtime has already resolved it.",
    `After the message tool succeeds, final reply exactly: ${WECHAT_SILENT_REPLY_TOKEN}.`,
].join("\n");

function normalizeWechatNonEmptyString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function pruneWechatSubagentCompletionClaims(now = Date.now()) {
    for (const [key, claimedAt] of wechatSubagentCompletionDirectClaims) {
        if (now - claimedAt > WECHAT_SUBAGENT_COMPLETION_DIRECT_TTL_MS) {
            wechatSubagentCompletionDirectClaims.delete(key);
        }
    }
    for (const [runId, deliveredAt] of wechatSubagentCompletionDirectDeliveredRunIds) {
        if (now - deliveredAt > WECHAT_SUBAGENT_COMPLETION_DIRECT_TTL_MS) {
            wechatSubagentCompletionDirectDeliveredRunIds.delete(runId);
        }
    }
    for (const [runId, record] of wechatSubagentCompletionDirectDeliveryRecords) {
        if (now - record.deliveredAt > WECHAT_SUBAGENT_COMPLETION_DIRECT_TTL_MS) {
            wechatSubagentCompletionDirectDeliveryRecords.delete(runId);
        }
    }
}

function claimWechatSubagentCompletionDirectDelivery(key: string): boolean {
    pruneWechatSubagentCompletionClaims();
    if (wechatSubagentCompletionDirectClaims.has(key)) {
        return false;
    }
    wechatSubagentCompletionDirectClaims.set(key, Date.now());
    return true;
}

function releaseWechatSubagentCompletionDirectDelivery(key: string): void {
    wechatSubagentCompletionDirectClaims.delete(key);
}

function rememberWechatSubagentCompletionDirectDelivered(
    runId: string | undefined,
    params?: {
        target?: {
            to: string;
            accountId?: string;
        };
        fallbackText?: string;
    },
): void {
    const normalized = normalizeWechatNonEmptyString(runId);
    if (!normalized) {
        return;
    }
    const now = Date.now();
    pruneWechatSubagentCompletionClaims();
    wechatSubagentCompletionDirectDeliveredRunIds.set(normalized, now);
    if (params?.target?.to) {
        wechatSubagentCompletionDirectDeliveryRecords.set(normalized, {
            deliveredAt: now,
            target: params.target,
            fallbackText: params.fallbackText,
        });
    }
}

function extractWechatAnnounceChildRunId(runId: unknown): string | undefined {
    if (typeof runId !== "string") {
        return undefined;
    }
    const trimmed = runId.trim();
    if (!trimmed.startsWith("announce:v1:")) {
        return undefined;
    }
    const parts = trimmed.split(":");
    return normalizeWechatNonEmptyString(parts.at(-1));
}

function wasWechatSubagentCompletionDirectDelivered(runId: unknown): boolean {
    pruneWechatSubagentCompletionClaims();
    const childRunId = extractWechatAnnounceChildRunId(runId);
    return Boolean(childRunId && wechatSubagentCompletionDirectDeliveredRunIds.has(childRunId));
}

function getWechatSubagentCompletionDirectDeliveryRecord(runId: unknown): {
    childRunId: string;
    record: {
        deliveredAt: number;
        target: {
            to: string;
            accountId?: string;
        };
        fallbackText?: string;
        textSentAt?: number;
    };
} | undefined {
    pruneWechatSubagentCompletionClaims();
    const childRunId = extractWechatAnnounceChildRunId(runId);
    if (!childRunId) {
        return undefined;
    }
    const record = wechatSubagentCompletionDirectDeliveryRecords.get(childRunId);
    return record ? { childRunId, record } : undefined;
}

function sanitizeWechatMediaRef(value: string): string {
    return value.trim().replace(/^["'`]+|["'`]+$/g, "").replace(/[),.;]+$/g, "").trim();
}

function isWechatPlaceholderMediaRef(value: string): boolean {
    const normalized = value.replace(/\\/g, "/").toLowerCase();
    return (
        normalized.includes("/path/to/") ||
        normalized.includes("/path/to/your/") ||
        normalized.includes("/your/image.")
    );
}

function looksLikeWechatMediaRef(value: string | undefined): value is string {
    const trimmed = sanitizeWechatMediaRef(value || "");
    if (!trimmed) {
        return false;
    }
    if (isWechatPlaceholderMediaRef(trimmed) || /^[a-zA-Z]:\/\//.test(trimmed)) {
        return false;
    }
    if (/^https?:\/\//i.test(trimmed)) {
        return WECHAT_MEDIA_REF_RE.test(trimmed);
    }
    return (
        /^(?:[a-zA-Z]:[\\/]|\/|\.{1,2}[\\/])/.test(trimmed) &&
        WECHAT_MEDIA_REF_RE.test(trimmed)
    );
}

function pushWechatMediaRef(output: string[], seen: Set<string>, value: unknown): void {
    if (typeof value !== "string") {
        return;
    }
    const mediaRef = sanitizeWechatMediaRef(value);
    if (!looksLikeWechatMediaRef(mediaRef) || seen.has(mediaRef)) {
        return;
    }
    seen.add(mediaRef);
    output.push(mediaRef);
}

function collectWechatMediaRefsFromText(text: string, output: string[], seen: Set<string>): void {
    for (const match of text.matchAll(/\b(?:MEDIA|FILE):\s*(?:"([^"]+)"|'([^']+)'|([^\s]+))/gi)) {
        pushWechatMediaRef(output, seen, match[1] || match[2] || match[3]);
    }
    for (const match of text.matchAll(/!\[[^\]]*]\(([^)\s]+)(?:\s+["'][^)]*["'])?\)/g)) {
        pushWechatMediaRef(output, seen, match[1]);
    }
    for (const match of text.matchAll(/\b(?:path|filePath|mediaUrl|url)=["']([^"']+)["']/gi)) {
        pushWechatMediaRef(output, seen, match[1]);
    }
    for (const line of text.split(/\r?\n/)) {
        const windowsPath = line.match(/(?:^|[\s("'`])([a-zA-Z]:[\\/](?!\/)[^\r\n"']+\.(?:png|jpe?g|webp|gif|bmp|mp4|mov|webm|mp3|wav|ogg|m4a|flac|pdf)\b)/i)?.[1];
        const posixPath = line.match(/(?:^|[\s("'`])(\/(?!\/)[^\r\n"']+\.(?:png|jpe?g|webp|gif|bmp|mp4|mov|webm|mp3|wav|ogg|m4a|flac|pdf)\b)/i)?.[1];
        pushWechatMediaRef(output, seen, windowsPath || posixPath);
    }
}

function collectWechatMediaRefs(value: unknown, output: string[], seen: Set<string>, key = "", depth = 0): void {
    if (depth > 8 || value == null) {
        return;
    }
    if (typeof value === "string") {
        if (/^(?:media|mediaurl|mediaurls|path|filepath|fileurl|url)$/i.test(key)) {
            pushWechatMediaRef(output, seen, value);
        }
        collectWechatMediaRefsFromText(value, output, seen);
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            collectWechatMediaRefs(item, output, seen, key, depth + 1);
        }
        return;
    }
    if (typeof value !== "object") {
        return;
    }
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
        collectWechatMediaRefs(childValue, output, seen, childKey, depth + 1);
    }
}

function readWechatAssistantText(message: unknown): string | undefined {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
        return undefined;
    }
    const record = message as Record<string, unknown>;
    if (record.role !== "assistant") {
        return undefined;
    }
    const texts: string[] = [];
    const text = normalizeWechatNonEmptyString(record.text);
    if (text) {
        texts.push(text);
    }
    const content = record.content;
    if (typeof content === "string" && content.trim()) {
        texts.push(content.trim());
    } else if (Array.isArray(content)) {
        for (const block of content) {
            if (typeof block === "string" && block.trim()) {
                texts.push(block.trim());
            } else if (block && typeof block === "object" && !Array.isArray(block)) {
                const blockText = normalizeWechatNonEmptyString((block as Record<string, unknown>).text);
                if (blockText) {
                    texts.push(blockText);
                }
            }
        }
    }
    const payloads = record.payloads;
    if (Array.isArray(payloads)) {
        for (const payload of payloads) {
            if (payload && typeof payload === "object" && !Array.isArray(payload)) {
                const payloadText = normalizeWechatNonEmptyString((payload as Record<string, unknown>).text);
                if (payloadText) {
                    texts.push(payloadText);
                }
            }
        }
    }
    return texts.join("\n").trim() || undefined;
}

function cleanWechatCompletionCaption(text: string | undefined): string {
    const cleaned = (text || "")
        .split(/\r?\n/)
        .filter((line) => {
            const trimmed = line.trim();
            return (
                trimmed &&
                !/^(?:MEDIA|FILE):/i.test(trimmed) &&
                !/^Attachments?:$/i.test(trimmed) &&
                !/\b(?:path|filePath|mediaUrl|url)=["']/i.test(trimmed) &&
                !looksLikeWechatMediaRef(trimmed)
            );
        })
        .join("\n")
        .trim();
    if (!cleaned || cleaned.length > 600 || /OpenClaw runtime context|Internal task completion event/i.test(cleaned)) {
        return "生成内容已完成。";
    }
    return cleaned;
}

function cleanWechatAnnounceFinalText(text: string | undefined, fallbackText?: string): string {
    const cleaned = (text || "")
        .split(/\r?\n/)
        .filter((line) => {
            const trimmed = line.trim();
            return (
                trimmed &&
                trimmed.toUpperCase() !== WECHAT_SILENT_REPLY_TOKEN &&
                !/^(?:MEDIA|FILE):/i.test(trimmed) &&
                !/^Attachments?:$/i.test(trimmed) &&
                !/\b(?:path|filePath|mediaUrl|url)=["']/i.test(trimmed) &&
                !looksLikeWechatMediaRef(trimmed)
            );
        })
        .join("\n")
        .trim();
    if (
        cleaned &&
        cleaned.length <= 700 &&
        !/OpenClaw runtime context|Internal task completion event|completion agent did not/i.test(cleaned)
    ) {
        return cleaned;
    }
    return fallbackText?.trim() || "图片生成好了。";
}

function extractWechatGeneratedImageSubject(text: string | undefined): string | undefined {
    const normalized = text?.replace(/[`*_#]/g, "").replace(/\s+/g, " ").trim();
    if (!normalized) {
        return undefined;
    }
    const patterns = [
        /生成(?:图片|图像|照片|图)\s*(?:一[只张个幅条])?([\p{Script=Han}A-Za-z0-9_-]{1,16})/u,
        /生成(?:一[只张个幅条])?([\p{Script=Han}A-Za-z0-9_-]{1,16})(?:的)?(?:图片|图像|照片|图)/u,
        /生成([\p{Script=Han}A-Za-z0-9_-]{1,16})(?:图片|图像|照片|图)/u,
    ];
    for (const pattern of patterns) {
        const subject = pattern.exec(normalized)?.[1]?.trim();
        if (subject && !/^(?:图片|图像|照片|图|一只|一张|一个)$/.test(subject)) {
            return subject;
        }
    }
    return undefined;
}

function buildWechatCompletionFallbackText(params: {
    requestText?: string;
    completionText?: string;
}): string {
    const subject =
        extractWechatGeneratedImageSubject(params.requestText) ||
        extractWechatGeneratedImageSubject(params.completionText);
    return subject ? `${subject}图片生成好了。` : "图片生成好了。";
}

function extractWechatSubagentCompletionPayload(messages: unknown[]): {
    text: string;
    mediaUrls: string[];
    fallbackText: string;
} | undefined {
    const lastUserIndex = (() => {
        for (let index = messages.length - 1; index >= 0; index -= 1) {
            const message = messages[index];
            if (message && typeof message === "object" && !Array.isArray(message) && (message as Record<string, unknown>).role === "user") {
                return index;
            }
        }
        return -1;
    })();
    const requestText = lastUserIndex >= 0 ? readWechatMessageText(messages[lastUserIndex]) : undefined;
    const completionMessages = messages.slice(Math.max(0, lastUserIndex + 1));

    let latestAssistantText = "";
    for (let index = completionMessages.length - 1; index >= 0; index -= 1) {
        latestAssistantText = readWechatAssistantText(completionMessages[index]) || "";
        if (latestAssistantText) {
            break;
        }
    }
    const mediaUrls: string[] = [];
    const seen = new Set<string>();
    if (latestAssistantText) {
        collectWechatMediaRefsFromText(latestAssistantText, mediaUrls, seen);
    }
    if (mediaUrls.length === 0) {
        const assistantMessages = completionMessages.filter((message) =>
            message &&
            typeof message === "object" &&
            !Array.isArray(message) &&
            (message as Record<string, unknown>).role === "assistant"
        );
        collectWechatMediaRefs(assistantMessages, mediaUrls, seen);
    }
    if (mediaUrls.length === 0) {
        collectWechatMediaRefs(completionMessages, mediaUrls, seen);
    }
    if (mediaUrls.length === 0) {
        return undefined;
    }
    return {
        text: cleanWechatCompletionCaption(latestAssistantText),
        mediaUrls,
        fallbackText: buildWechatCompletionFallbackText({
            requestText,
            completionText: latestAssistantText,
        }),
    };
}

async function deliverWechatSubagentCompletionDirectly(params: {
    api: OpenClawPluginApi;
    childSessionKey: string;
    childRunId?: string;
    target: {
        to: string;
        accountId?: string;
    };
}): Promise<{
    delivered: boolean;
    fallbackText?: string;
}> {
    if (!wechatPlugin.outbound?.sendMedia && !wechatPlugin.outbound?.sendText) {
        return { delivered: false };
    }
    const messagesResult = await params.api.runtime.subagent.getSessionMessages({
        sessionKey: params.childSessionKey,
        limit: 120,
    });
    const completion = extractWechatSubagentCompletionPayload(messagesResult.messages || []);
    if (!completion) {
        return { delivered: false };
    }

    const cfg = params.api.runtime.config.current();
    let sentAny = false;
    for (const mediaUrl of completion.mediaUrls) {
        if (!wechatPlugin.outbound?.sendMedia) {
            continue;
        }
        const result = await wechatPlugin.outbound.sendMedia({
            to: params.target.to,
            mediaUrl,
            text: "",
            accountId: params.target.accountId || "default",
            cfg,
        } as any);
        if (result?.ok === false) {
            params.api.logger.warn?.(
                `[WeChat] Direct subagent completion media send failed runId=${params.childRunId || ""} ` +
                `media="${summarizeWechatTextForLog(mediaUrl, 180)}" error=${result.error?.message || result.error || "unknown"}`,
            );
            continue;
        }
        sentAny = true;
    }
    if (!sentAny && completion.text && wechatPlugin.outbound?.sendText) {
        const result = await wechatPlugin.outbound.sendText({
            to: params.target.to,
            text: completion.text,
            accountId: params.target.accountId || "default",
            cfg,
        } as any);
        sentAny = result?.ok !== false;
    }
    return {
        delivered: sentAny,
        fallbackText: completion.fallbackText,
    };
}

function shouldAddWechatMessageToolCompletionPrompt(event: { prompt?: unknown }, ctx: Record<string, unknown>): boolean {
    const sessionKey = resolveWechatContextSessionKey(ctx);
    const hasWechatContext = Boolean(
        sessionKey?.includes(":wechat:") ||
        canonicalWechatChannelId(ctx.messageProvider) ||
        canonicalWechatChannelId(ctx.channelId),
    );
    if (!hasWechatContext) {
        return false;
    }
    const prompt = typeof event.prompt === "string" ? event.prompt : "";
    return (
        /task completion event|runtime-generated completion|background task|subagent|message tool/i.test(prompt) ||
        prompt.includes("OpenClaw runtime context")
    );
}

function buildWechatMessageToolCompletionContext(ctx: Record<string, unknown>): string {
    if (!wasWechatSubagentCompletionDirectDelivered(ctx.runId)) {
        return WECHAT_MESSAGE_TOOL_COMPLETION_CONTEXT;
    }
    return [
        WECHAT_MESSAGE_TOOL_COMPLETION_CONTEXT,
        "",
        "The WeChat plugin already sent the generated media for this completed subagent run without a caption.",
        "Do not resend the image/media and do not inspect WeChat history. Send the final user-facing wording via `message(action=\"send\", message=\"...\")`, then finish with exactly `NO_REPLY`.",
    ].join("\n");
}

function readWechatMessageText(message: unknown): string | undefined {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
        return undefined;
    }
    const record = message as Record<string, unknown>;
    const texts: string[] = [];
    const directText = normalizeWechatNonEmptyString(record.text);
    if (directText) {
        texts.push(directText);
    }
    const content = record.content;
    if (typeof content === "string" && content.trim()) {
        texts.push(content.trim());
    } else if (Array.isArray(content)) {
        for (const block of content) {
            if (typeof block === "string" && block.trim()) {
                texts.push(block.trim());
            } else if (block && typeof block === "object" && !Array.isArray(block)) {
                const blockText = normalizeWechatNonEmptyString((block as Record<string, unknown>).text);
                if (blockText) {
                    texts.push(blockText);
                }
            }
        }
    }
    return texts.join("\n").trim() || undefined;
}

function collectWechatFinalizeContextText(event: { lastAssistantMessage?: unknown; messages?: unknown[] }): string {
    const texts: string[] = [];
    const lastAssistantMessage = normalizeWechatNonEmptyString(event.lastAssistantMessage);
    if (lastAssistantMessage) {
        texts.push(lastAssistantMessage);
    }
    const messages = Array.isArray(event.messages) ? event.messages.slice(-12) : [];
    for (const message of messages) {
        const text = readWechatMessageText(message);
        if (text) {
            texts.push(text);
        }
    }
    return texts.join("\n\n");
}

function looksLikeWechatCompletionFinalizeContext(text: string): boolean {
    return /Internal task completion event|OpenClaw runtime context|background task completed|task completion|subagent|message[-_ ]tool[-_ ]only|sourceReplyDeliveryMode/i.test(text);
}

function buildWechatCompletionFinalizeRetryInstruction(lastAssistantText: string): string {
    const mediaUrls: string[] = [];
    collectWechatMediaRefsFromText(lastAssistantText, mediaUrls, new Set<string>());
    const caption = cleanWechatCompletionCaption(lastAssistantText);
    const primaryMedia = mediaUrls[0];
    const mediaLine = primaryMedia
        ? `Call the message tool now with action="send", message=${JSON.stringify(caption)}, and filePath=${JSON.stringify(primaryMedia)}.`
        : "Call the message tool now with action=\"send\" and put the visible user-facing update in the message field.";
    const extraMediaLine = mediaUrls.length > 1
        ? `Also include the remaining files with attachments=${JSON.stringify(mediaUrls.slice(1).map((filePath) => ({ filePath })))}.`
        : "";
    return [
        "WeChat completion delivery correction:",
        "This route is message-tool-only. Your previous final answer is private and does not count as WeChat delivery.",
        mediaLine,
        extraMediaLine,
        "Do not output plain final text, and do not output MEDIA:/FILE: markers.",
        "The current WeChat conversation is the default target; omit target/channel unless sending elsewhere. If you must specify a channel, use channel=\"wechat\".",
        `After the message tool succeeds, final answer exactly: ${WECHAT_SILENT_REPLY_TOKEN}.`,
    ].filter(Boolean).join("\n");
}

function shouldReviseWechatCompletionFinalize(
    event: { lastAssistantMessage?: unknown; messages?: unknown[]; sessionKey?: unknown },
    ctx: Record<string, unknown>,
): { revise: boolean; instruction?: string } {
    const sessionKey = resolveWechatContextSessionKey({
        sessionKey: event.sessionKey,
        ...ctx,
    });
    const hasWechatContext = Boolean(
        sessionKey?.includes(":wechat:") ||
        canonicalWechatChannelId(ctx.messageProvider) ||
        canonicalWechatChannelId(ctx.channelId),
    );
    if (!hasWechatContext) {
        return { revise: false };
    }

    const lastAssistantText = normalizeWechatNonEmptyString(event.lastAssistantMessage);
    if (!lastAssistantText || lastAssistantText.trim().toUpperCase() === WECHAT_SILENT_REPLY_TOKEN) {
        return { revise: false };
    }
    const contextText = collectWechatFinalizeContextText(event);
    if (!looksLikeWechatCompletionFinalizeContext(contextText)) {
        return { revise: false };
    }
    const mediaUrls: string[] = [];
    collectWechatMediaRefsFromText(lastAssistantText, mediaUrls, new Set<string>());
    const hasMediaMarker = /\b(?:MEDIA|FILE):/i.test(lastAssistantText) || mediaUrls.length > 0;
    const explicitlyMessageToolOnly = /message[-_ ]tool[-_ ]only|sourceReplyDeliveryMode/i.test(contextText);
    if (!hasMediaMarker && !explicitlyMessageToolOnly) {
        return { revise: false };
    }
    return {
        revise: true,
        instruction: buildWechatCompletionFinalizeRetryInstruction(lastAssistantText),
    };
}

function normalizeWechatToolName(value: unknown): string {
    const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
    const withoutNamespace = raw.replace(/^functions[._-]/, "").replace(/^tools[._-]/, "");
    if (withoutNamespace === "bash" || withoutNamespace === "shell") {
        return "exec";
    }
    return withoutNamespace.replace(/-/g, "_");
}

function shouldBlockWechatCompletionAnnounceTool(
    event: { toolName?: unknown; runId?: unknown },
    ctx: Record<string, unknown>,
): boolean {
    const runId = normalizeWechatNonEmptyString(ctx.runId) || normalizeWechatNonEmptyString(event.runId);
    if (!runId?.startsWith("announce:v1:")) {
        return false;
    }
    const sessionKey = resolveWechatContextSessionKey(ctx);
    const hasWechatContext = Boolean(
        sessionKey?.includes(":wechat:") ||
        canonicalWechatChannelId(ctx.messageProvider) ||
        canonicalWechatChannelId(ctx.channelId),
    );
    if (!hasWechatContext) {
        return false;
    }
    return normalizeWechatToolName(event.toolName) === "exec";
}

function extractWechatLatestAssistantText(messages: unknown[] | undefined): string | undefined {
    if (!Array.isArray(messages)) {
        return undefined;
    }
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const text = readWechatAssistantText(messages[index]);
        if (text) {
            return text;
        }
    }
    return undefined;
}

async function maybeDeliverWechatAnnounceFinalTextDirectly(params: {
    api: OpenClawPluginApi;
    event: {
        runId?: unknown;
        lastAssistantMessage?: unknown;
        messages?: unknown[];
    };
    ctx: Record<string, unknown>;
}): Promise<boolean> {
    const runId =
        normalizeWechatNonEmptyString(params.event.runId) ||
        normalizeWechatNonEmptyString(params.ctx.runId);
    const delivery = getWechatSubagentCompletionDirectDeliveryRecord(runId);
    if (!delivery || delivery.record.textSentAt || !wechatPlugin.outbound?.sendText) {
        return false;
    }
    const finalText = cleanWechatAnnounceFinalText(
        normalizeWechatNonEmptyString(params.event.lastAssistantMessage) ||
        extractWechatLatestAssistantText(params.event.messages),
        delivery.record.fallbackText,
    );
    if (!finalText || finalText.toUpperCase() === WECHAT_SILENT_REPLY_TOKEN) {
        return false;
    }
    delivery.record.textSentAt = Date.now();
    const cfg = params.api.runtime.config.current();
    const result = await wechatPlugin.outbound.sendText({
        to: delivery.record.target.to,
        text: finalText,
        accountId: delivery.record.target.accountId || "default",
        cfg,
    } as any);
    if (result?.ok === false) {
        delivery.record.textSentAt = undefined;
        params.api.logger.warn?.(
            `[WeChat] Direct announce final text send failed runId=${runId || ""} ` +
            `to=${summarizeWechatTextForLog(delivery.record.target.to, 120)} ` +
            `error=${result.error?.message || result.error || "unknown"}`,
        );
        return false;
    }
    params.api.logger.info(
        `[WeChat] Delivered announce final text directly via plugin runId=${runId || ""}` +
        ` childRunId=${delivery.childRunId}` +
        ` to=${summarizeWechatTextForLog(delivery.record.target.to, 120)}`,
    );
    return true;
}

export function registerWechatSubagentLifecycleHooks(api: OpenClawPluginApi): void {
    api.on("agent_end", async (event, ctx) => {
        await maybeDeliverWechatAnnounceFinalTextDirectly({
            api,
            event,
            ctx: ctx as Record<string, unknown>,
        });
        if (ctx.runId) {
            clearWechatToolAuthForRun(ctx.runId);
        }
    }, { priority: 100 });

    api.on("before_prompt_build", (event, ctx) => {
        if (!shouldAddWechatMessageToolCompletionPrompt(event, ctx as Record<string, unknown>)) {
            return;
        }
        return {
            appendSystemContext: buildWechatMessageToolCompletionContext(ctx as Record<string, unknown>),
        };
    }, { priority: 9_500 });

    api.on("before_tool_call", (event, ctx) => {
        if (!shouldBlockWechatCompletionAnnounceTool(event, ctx as Record<string, unknown>)) {
            return;
        }
        return {
            block: true,
            blockReason: "WeChat completion delivery already has a resolved target; use message(action=\"send\") directly instead of exec/query_wechat.",
        };
    }, { priority: 20_000 });

    api.on("before_agent_finalize", async (event, ctx) => {
        const deliveredFinalText = await maybeDeliverWechatAnnounceFinalTextDirectly({
            api,
            event,
            ctx: ctx as Record<string, unknown>,
        });
        if (deliveredFinalText) {
            return {
                action: "finalize" as const,
                reason: "WeChat announce final text was delivered directly by the plugin.",
            };
        }
        const decision = shouldReviseWechatCompletionFinalize(
            event,
            ctx as Record<string, unknown>,
        );
        if (!decision.revise || !decision.instruction) {
            return;
        }
        return {
            action: "revise" as const,
            reason: "WeChat completion final text must be delivered with the message tool.",
            retry: {
                instruction: decision.instruction,
                idempotencyKey: "wechat-completion-message-tool-finalize",
                maxAttempts: 1,
            },
        };
    }, { priority: 9_600 });

    api.on("subagent_delivery_target", async (event, ctx) => {
        const normalized = normalizeWechatSubagentDeliveryOrigin({
            origin: event.requesterOrigin,
            requesterSessionKey: event.requesterSessionKey,
        });
        const cfg = api.runtime.config.current();
        if (!normalized) {
            return;
        }
        if (event.requesterOrigin && typeof event.requesterOrigin === "object") {
            event.requesterOrigin.channel = normalized.origin.channel;
            event.requesterOrigin.accountId = normalized.origin.accountId;
            event.requesterOrigin.to = normalized.origin.to;
            if (normalized.origin.threadId != null) {
                event.requesterOrigin.threadId = normalized.origin.threadId;
            }
        }
        if (normalized.changed) {
            const bridgeConfig = resolveWechatExtensionConfig(cfg, api.logger);
            api.logger.info(
                `[WeChat] Canonicalized subagent delivery target runId=${ctx.runId || event.childRunId || ""}` +
                ` requester=${event.requesterSessionKey}` +
                ` channel=${normalized.previousChannel || "missing"}->wechat` +
                ` to=${redactWechatTextForLogs(summarizeWechatTextForLog(normalized.origin.to || "", 120), bridgeConfig)}` +
                `${normalized.inferredFromSession ? " source=session-key" : ""}`,
            );
        }
        if (event.expectsCompletionMessage && normalized.origin.to) {
            const deliveryKey = [
                event.childRunId || ctx.runId || event.childSessionKey,
                event.requesterSessionKey,
                normalized.origin.to,
            ].join("|");
            if (!claimWechatSubagentCompletionDirectDelivery(deliveryKey)) {
                return {
                    origin: normalized.origin,
                    delivered: true,
                } as any;
            }
            try {
                const delivery = await deliverWechatSubagentCompletionDirectly({
                    api,
                    childSessionKey: event.childSessionKey,
                    childRunId: event.childRunId || ctx.runId,
                    target: {
                        to: normalized.origin.to,
                        accountId: normalized.origin.accountId,
                    },
                });
                if (delivery.delivered) {
                    rememberWechatSubagentCompletionDirectDelivered(event.childRunId || ctx.runId, {
                        target: {
                            to: normalized.origin.to,
                            accountId: normalized.origin.accountId,
                        },
                        fallbackText: delivery.fallbackText,
                    });
                    api.logger.info(
                        `[WeChat] Delivered subagent completion directly via plugin runId=${ctx.runId || event.childRunId || ""}` +
                        ` requester=${event.requesterSessionKey}` +
                        ` to=${redactWechatTextForLogs(summarizeWechatTextForLog(normalized.origin.to, 120), resolveWechatExtensionConfig(cfg, api.logger))}`,
                    );
                    return {
                        origin: normalized.origin,
                        delivered: true,
                    } as any;
                }
                releaseWechatSubagentCompletionDirectDelivery(deliveryKey);
            } catch (err: any) {
                releaseWechatSubagentCompletionDirectDelivery(deliveryKey);
                api.logger.warn?.(
                    `[WeChat] Direct subagent completion delivery failed runId=${ctx.runId || event.childRunId || ""} ` +
                    `error=${err?.message || err}`,
                );
            }
        }
        return {
            origin: normalized.origin,
        };
    }, { priority: 10_000 });

    api.on("subagent_spawned", async (event, ctx) => {
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
    }, { priority: 10_000 });

    api.on("session_end", (_event, ctx) => {
        const sessionKey = resolveWechatContextSessionKey(ctx as Record<string, unknown>);
        if (sessionKey) {
            clearWechatToolAuthForSession(sessionKey);
        }
    }, { priority: 100 });
}
