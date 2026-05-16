import type { resolveWechatExtensionConfig } from "./config.js";
import { redactWechatUnknownText, redactWechatWxids } from "./redaction.js";

export function stripFalseWechatMediaFailureSuffix(text: string): {
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
export function mergeOverlappingStrings(current: string, next: string): string {
    if (!next) return current;
    if (!current) return next;

    // 1. 完全包含检查
    if (next.startsWith(current)) return next;
    if (current.includes(next)) return current;

    // 清理空白字符以进行模糊匹配（防止模型输出过程中更改了 \n 为 \n\n 导致重叠算法失效）
    const normC = current.replace(/\s+/g, "");
    const normN = next.replace(/\s+/g, "");

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
            const separator =
                current.endsWith("\n") || next.slice(cutIndex).startsWith("\n") ? "" : " ";
            return current + separator + next.slice(cutIndex).trimStart();
        }
    }

    // 4. 无重叠，正常相加
    const separator = current.endsWith("\n") || next.startsWith("\n") ? "" : "\n";
    return current + separator + next;
}

export type WechatReplyCollapseResult = {
    text: string;
    mode: "none" | "exact-repeat" | "dominant-repeat";
    originalLength: number;
    collapsedLength: number;
    repeatCount?: number;
    unitLength?: number;
    leftoverLength?: number;
};

export function collapseRepeatedReplyText(text: string): WechatReplyCollapseResult {
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

export function summarizeWechatTextForLog(text: unknown, maxLength = 160): string {
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

export function redactWechatTextForLogs(
    text: string,
    config?: ReturnType<typeof resolveWechatExtensionConfig>,
): string {
    return redactWechatWxids(text, {
        enabled: config?.redactWxidsInLogs !== false,
        exactMatches: config?.redactExtraWxids,
    });
}

export function redactWechatPayloadForLogs(
    value: unknown,
    config?: ReturnType<typeof resolveWechatExtensionConfig>,
): unknown {
    return redactWechatUnknownText(value, {
        enabled: config?.redactWxidsInLogs !== false,
        exactMatches: config?.redactExtraWxids,
    });
}

export function rewriteWechatNonOwnerAddressing(text: string, params: {
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
