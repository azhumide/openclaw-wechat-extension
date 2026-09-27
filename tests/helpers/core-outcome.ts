// 核心投递结果判定函数的**逐字快照**（vendored snapshot）。
//
// 为什么要快照：这两个函数决定「核心把这次投递记成什么账」，是我们修复的判据本身。
// 插件仓库不能依赖 openclaw 源码树（本机无 node_modules，且插件是独立仓库），
// 所以只能内联一份。
//
// 为什么不会漂移：T13 有一道漂移守卫 —— 只要核心源码存在（开发机上是存在的），
// 就逐字比对这里的函数体与核心原文件；一旦上游改动，守卫立刻失败，
// 避免「测试替旧行为背书」。
//
// 上游来源：openclaw/src/auto-reply/reply/reply-dispatch-outcome.ts
//   - isReplyDispatchDeliveryPending
//   - resolveReplyDispatchDeliveryOutcome

export type ReplyDispatchDeliveryOutcome =
    | "delivered"
    | "delivered-not-visible"
    | "channel-transform"
    | "cancelled"
    | "failed-before-deliver"
    | "recovery-owned"
    | "failed-deliver";

function isRecord(value: unknown): value is Record<string, any> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Identityless completion proves ambiguity, not queue custody or an intentional no-send. */
export function isReplyDispatchDeliveryPending(result: unknown): boolean {
    return (
        isRecord(result) &&
        isRecord(result.suppression) &&
        result.suppression.reason === "adapter_returned_no_identity"
    );
}

export function resolveReplyDispatchDeliveryOutcome(result: unknown): ReplyDispatchDeliveryOutcome {
    if (isReplyDispatchDeliveryPending(result)) {
        return "delivered-not-visible";
    }
    if (isRecord(result) && result.ambiguous === true) {
        return "failed-deliver";
    }
    if (!isRecord(result) || result.visibleReplySent !== false) {
        return "delivered";
    }
    return isRecord(result.suppression) && result.suppression.reason === "channel_transform"
        ? "channel-transform"
        : "delivered-not-visible";
}

export function shouldRetryReplyDispatch(outcome: ReplyDispatchDeliveryOutcome): boolean {
    return (
        outcome === "delivered-not-visible" ||
        outcome === "cancelled" ||
        outcome === "failed-before-deliver"
    );
}

/** 核心源码路径（开发机上存在；生产/CI 上可能不存在，守卫会自行跳过）。 */
export const CORE_OUTCOME_SOURCE_PATH =
    "/home/rs/openclaw/src/auto-reply/reply/reply-dispatch-outcome.ts";
