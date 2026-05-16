import { canonicalWechatChannelId } from "./canonicalization-channel.js";

export type WechatDeliveryOrigin = {
    channel?: string;
    accountId?: string;
    to?: string;
    threadId?: string | number;
};

export function normalizeWechatMessageToolTarget(value: unknown): string {
    let normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized) {
        return "";
    }

    const removablePrefixes = new Set([
        "wechat",
        "weixin",
        "openclaw-weixin",
        "wechatid",
        "channel",
        "group",
        "chat",
        "user",
        "direct",
        "dm",
    ]);
    for (let index = 0; index < 4; index += 1) {
        const separatorIndex = normalized.indexOf(":");
        if (separatorIndex <= 0) {
            break;
        }
        const prefix = normalized.slice(0, separatorIndex).trim().toLowerCase();
        if (!removablePrefixes.has(prefix)) {
            break;
        }
        normalized = normalized.slice(separatorIndex + 1).trim();
        if (!normalized) {
            break;
        }
    }

    return normalized;
}

export function parseWechatDeliveryRouteFromSessionKey(sessionKey: string | undefined): {
    to: string;
    threadId: string;
    chatType?: "direct" | "group";
} | undefined {
    const trimmed = sessionKey?.trim();
    if (!trimmed) {
        return undefined;
    }

    const parts = trimmed.split(":").map((part) => part.trim());
    for (let index = 0; index < parts.length; index += 1) {
        if (!canonicalWechatChannelId(parts[index])) {
            continue;
        }

        const rawKind = parts[index + 1]?.toLowerCase() || "";
        const chatType =
            rawKind === "group" || rawKind === "channel" || rawKind === "room"
                ? "group"
                : rawKind === "direct" || rawKind === "user" || rawKind === "dm"
                    ? "direct"
                    : undefined;
        const targetStartIndex = chatType ? index + 2 : index + 1;
        const to = parts.slice(targetStartIndex).join(":").trim();
        if (!to) {
            return undefined;
        }

        return {
            to,
            threadId: to,
            chatType: chatType || (to.toLowerCase().endsWith("@chatroom") ? "group" : undefined),
        };
    }

    return undefined;
}

export function normalizeWechatSubagentDeliveryOrigin(params: {
    origin?: WechatDeliveryOrigin;
    requesterSessionKey?: string;
}): {
    origin: WechatDeliveryOrigin;
    previousChannel?: string;
    inferredFromSession: boolean;
    changed: boolean;
} | undefined {
    const source = params.origin && typeof params.origin === "object" ? params.origin : undefined;
    const sessionRoute = parseWechatDeliveryRouteFromSessionKey(params.requesterSessionKey);
    const previousChannel = typeof source?.channel === "string" ? source.channel.trim() : "";
    const canonicalChannel = canonicalWechatChannelId(previousChannel);
    if (!canonicalChannel && !sessionRoute) {
        return undefined;
    }

    const rawTo = typeof source?.to === "string" ? source.to.trim() : "";
    const normalizedTo = rawTo ? normalizeWechatMessageToolTarget(rawTo) : "";
    const to = normalizedTo || sessionRoute?.to;
    if (!to) {
        return undefined;
    }

    const accountId =
        typeof source?.accountId === "string" && source.accountId.trim()
            ? source.accountId.trim()
            : "default";
    const sourceThreadId =
        typeof source?.threadId === "string" && source.threadId.trim()
            ? source.threadId.trim()
            : (typeof source?.threadId === "number" && Number.isFinite(source.threadId)
                ? source.threadId
                : undefined);
    const threadId = sourceThreadId ?? sessionRoute?.threadId ?? to;
    const origin: WechatDeliveryOrigin = {
        channel: "wechat",
        accountId,
        to,
        ...(threadId != null && threadId !== "" ? { threadId } : {}),
    };
    const changed =
        previousChannel !== "wechat" ||
        rawTo !== to ||
        !source?.accountId ||
        sourceThreadId == null;

    return {
        origin,
        previousChannel: previousChannel || undefined,
        inferredFromSession: !normalizedTo && Boolean(sessionRoute),
        changed,
    };
}

export function wechatDeliveryOriginsEqual(
    left: WechatDeliveryOrigin | undefined,
    right: WechatDeliveryOrigin | undefined,
): boolean {
    if (!left && !right) {
        return true;
    }
    if (!left || !right) {
        return false;
    }
    return (
        left.channel === right.channel &&
        left.accountId === right.accountId &&
        left.to === right.to &&
        String(left.threadId ?? "") === String(right.threadId ?? "")
    );
}
