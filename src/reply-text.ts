import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { resolveWechatExtensionConfig } from "./config.js";
import {
    collapseRepeatedReplyText,
    mergeOverlappingStrings,
    redactWechatTextForLogs,
    summarizeWechatTextForLog,
    type WechatReplyCollapseResult,
} from "./text.js";
import { isWechatInternalStatusReply } from "./tool-log.js";

const MEDIA_PLACEHOLDER_LINE_RE = /^(?:MEDIA|FILE):?\s*$/gmi;
const MEDIA_DIRECTIVE_RE = /(?:MEDIA|FILE):([^\s]+)/g;

export function readWechatReplyFinalErrorText(payload: any): string {
    return typeof payload?.text === "string"
        ? payload.text
        : (
            typeof payload?.message === "string"
                ? payload.message
                : (
                    typeof payload?.content === "string"
                        ? payload.content
                        : ""
                )
        );
}

export function buildWechatReplyPayloadPreviews(payload: Record<string, unknown>): string[] {
    return Object.keys(payload).map((key) => {
        const value = payload[key];
        const text = typeof value === "string" ? value : JSON.stringify(value);
        return `${key}=(${(text || "").substring(0, 40)}${(text || "").length > 40 ? "..." : ""})`;
    });
}

export function cleanWechatReplyIncomingText(text: string): string {
    return text.replace(MEDIA_PLACEHOLDER_LINE_RE, "").trim();
}

export function readWechatReplyIncomingText(args: any[], payload: any): string {
    const textFromArg0 = typeof args[0] === "string" ? args[0] : "";
    let incomingText =
        textFromArg0 ||
        payload.text ||
        payload.message ||
        payload.content ||
        payload.answer ||
        payload.stdout ||
        payload.result ||
        payload.output ||
        payload.data ||
        "";

    if (typeof incomingText === "string") {
        incomingText = cleanWechatReplyIncomingText(incomingText);
    }

    if (!incomingText && Array.isArray(payload.blocks)) {
        let combined = "";
        for (const block of payload.blocks) {
            let blockText = typeof block === "string" ? block : (block.text || block.content || "");
            blockText = blockText.trim();
            if (!blockText || blockText === "MEDIA" || blockText === "FILE") {
                continue;
            }
            combined = mergeOverlappingStrings(combined, blockText);
        }
        incomingText = combined;
    }

    return typeof incomingText === "string" ? incomingText : "";
}

export function mergeWechatReplyTurnText(current: string, next: string): string {
    return next ? mergeOverlappingStrings(current, next) : current;
}

export function readWechatPartialReplyText(payload: any): string {
    const text = payload.text || payload.content || payload.message || payload.answer || "";
    return typeof text === "string" ? cleanWechatReplyIncomingText(text) : "";
}

export function deriveWechatIncrementalReplyText(
    fullText: string,
    cumulativeSentText: string,
): string {
    if (cumulativeSentText && fullText.startsWith(cumulativeSentText)) {
        return fullText.substring(cumulativeSentText.length);
    }
    if (cumulativeSentText && !fullText.startsWith(cumulativeSentText)) {
        const lastSentIndex = fullText.lastIndexOf(cumulativeSentText);
        if (lastSentIndex !== -1) {
            return fullText.substring(lastSentIndex + cumulativeSentText.length);
        }
    }
    return fullText;
}

export function formatWechatReplyCollapseLogDetails(
    result: WechatReplyCollapseResult,
): string {
    return `mode=${result.mode} ` +
        `from=${result.originalLength} to=${result.collapsedLength}` +
        `${result.repeatCount ? ` repeats=${result.repeatCount}` : ""}` +
        `${result.unitLength ? ` unit=${result.unitLength}` : ""}` +
        `${result.leftoverLength !== undefined ? ` leftover=${result.leftoverLength}` : ""}`;
}

export function normalizeWechatReplyTextForDelivery(params: {
    text: string;
    stage: "full" | "incremental";
    logger: OpenClawPluginApi["logger"];
    bridgeConfig: ReturnType<typeof resolveWechatExtensionConfig>;
}): {
    text: string;
    shouldSkip: boolean;
} {
    const collapseResult = collapseRepeatedReplyText(params.text);
    const text = collapseResult.text;
    if (collapseResult.mode !== "none") {
        params.logger.info(
            `[WeChat] Collapsed duplicated reply text stage=${params.stage} ` +
            formatWechatReplyCollapseLogDetails(collapseResult),
        );
    }
    if (text.toUpperCase().includes("NO_REPLY")) {
        params.logger.info(`[WeChat] Skipping reply due to NO_REPLY signal detected`);
        return {
            text,
            shouldSkip: true,
        };
    }
    const internalReply = isWechatInternalStatusReply(text);
    if (internalReply.matched) {
        params.logger.info(
            `[WeChat] Skipping internal reply stage=${params.stage} reason=${internalReply.reason} text="${summarizeWechatTextForLog(redactWechatTextForLogs(text, params.bridgeConfig), 160)}"`,
        );
        return {
            text,
            shouldSkip: true,
        };
    }
    return {
        text,
        shouldSkip: false,
    };
}

export function isWechatReplyTextRedundantByWhitespace(params: {
    cumulativeSentText: string;
    text: string;
}): boolean {
    if (!params.text.trim()) {
        return false;
    }
    const normalizeWhitespace = (text: string) => text.replace(/\s+/g, " ").trim();
    return normalizeWhitespace(params.cumulativeSentText).includes(
        normalizeWhitespace(params.text),
    );
}

export function stripWechatReplyMediaDirectives(text: string): string {
    return text.replace(MEDIA_DIRECTIVE_RE, "").trim();
}

export function appendWechatCumulativeSentText(params: {
    cumulativeSentText: string;
    textToProcess: string;
}): string {
    const textOnly = stripWechatReplyMediaDirectives(params.textToProcess);
    if (!textOnly) {
        return params.cumulativeSentText;
    }
    return params.cumulativeSentText +
        (params.cumulativeSentText ? (textOnly.startsWith("\n") ? "" : "\n") : "") +
        textOnly;
}
