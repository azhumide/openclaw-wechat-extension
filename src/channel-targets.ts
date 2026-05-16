import {
    stripChannelTargetPrefix,
    stripTargetKindPrefix,
} from "openclaw/plugin-sdk/channel-core";

export const WECHAT_MESSAGING_TARGET_PREFIXES = ["wechat", "weixin", "openclaw-weixin", "wechatId"] as const;

export function stripWechatRouteTargetPrefixes(raw: string | undefined): string {
    let next = raw?.trim() || "";
    for (let index = 0; index < 4; index += 1) {
        const previous = next;
        next = stripTargetKindPrefix(
            stripChannelTargetPrefix(next, ...WECHAT_MESSAGING_TARGET_PREFIXES),
        ).trim();
        if (next === previous) {
            break;
        }
    }
    return next;
}

function hasWechatRouteTargetPrefix(raw: string | undefined): boolean {
    let next = raw?.trim() || "";
    for (let index = 0; index < 4; index += 1) {
        if (!next) {
            return false;
        }
        const withoutProvider = stripChannelTargetPrefix(next, ...WECHAT_MESSAGING_TARGET_PREFIXES);
        if (withoutProvider !== next) {
            return true;
        }
        const withoutKind = stripTargetKindPrefix(next);
        if (withoutKind === next) {
            return false;
        }
        next = withoutKind.trim();
    }
    return false;
}

export function inferWechatRouteTargetChatType(raw: string | undefined): "direct" | "group" | undefined {
    let next = raw?.trim() || "";
    for (let index = 0; index < 4; index += 1) {
        if (!next) {
            return undefined;
        }
        if (/^(group|channel|room):/i.test(next)) {
            return "group";
        }
        if (/^(user|direct|dm):/i.test(next)) {
            return "direct";
        }
        const withoutProvider = stripChannelTargetPrefix(next, ...WECHAT_MESSAGING_TARGET_PREFIXES);
        if (withoutProvider !== next) {
            next = withoutProvider.trim();
            continue;
        }
        const withoutKind = stripTargetKindPrefix(next);
        if (withoutKind === next) {
            return undefined;
        }
        next = withoutKind.trim();
    }
    return undefined;
}

export function looksLikeWechatTargetId(raw: string, normalized?: string): boolean {
    const candidate = stripWechatRouteTargetPrefixes(normalized || raw);
    if (!candidate) {
        return false;
    }
    const lower = candidate.toLowerCase();
    if (lower.endsWith("@chatroom")) return true;
    if (lower.startsWith("wxid_")) return true;
    if (/^\d{5,}(@chatroom)?$/i.test(candidate)) return true;
    if (inferWechatRouteTargetChatType(raw)) return true;
    return hasWechatRouteTargetPrefix(raw);
}

export function normalizeWechatMessagingTarget(raw: string): string | undefined {
    const targetId = stripWechatRouteTargetPrefixes(raw);
    if (!targetId) {
        return undefined;
    }
    if (!hasWechatRouteTargetPrefix(raw) && !looksLikeWechatTargetId(raw, targetId)) {
        return undefined;
    }
    return `wechat:${targetId.trim()}`;
}

export function parseWechatExplicitTarget(raw: string): {
    to: string;
    chatType?: "direct" | "group";
} | null {
    const targetId = stripWechatRouteTargetPrefixes(raw);
    if (!targetId) {
        return null;
    }
    const explicitChatType = inferWechatRouteTargetChatType(raw);
    const isGroup = explicitChatType === "group" || targetId.toLowerCase().endsWith("@chatroom");
    return {
        to: targetId,
        chatType: isGroup ? "group" : "direct",
    };
}
