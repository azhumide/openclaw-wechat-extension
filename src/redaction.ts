export type WechatRedactionOptions = {
    enabled?: boolean;
    keepPrefix?: number;
    keepSuffix?: number;
    exactMatches?: string[];
};

const WXID_PATTERN = /\bwxid_[a-zA-Z0-9]+\b/g;

function escapeWechatRedactionRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function maskWechatIdentifier(value: string, options?: WechatRedactionOptions): string {
    const keepPrefix = Math.max(0, options?.keepPrefix ?? 2);
    const keepSuffix = Math.max(0, options?.keepSuffix ?? 2);
    const visiblePrefix = value.slice(0, keepPrefix);
    const visibleSuffix = keepSuffix > 0 ? value.slice(-keepSuffix) : "";
    const hiddenLength = Math.max(3, value.length - visiblePrefix.length - visibleSuffix.length);
    return `${visiblePrefix}${"*".repeat(hiddenLength)}${visibleSuffix}`;
}

function redactWechatExactMatches(text: string, options?: WechatRedactionOptions): string {
    const exactMatches = (options?.exactMatches || [])
        .map((entry) => entry.trim())
        .filter(Boolean)
        .sort((a, b) => b.length - a.length);
    if (exactMatches.length === 0) {
        return text;
    }

    const pattern = new RegExp(
        `(^|[^a-zA-Z0-9_])(${exactMatches.map(escapeWechatRedactionRegex).join("|")})(?=$|[^a-zA-Z0-9_])`,
        "gi",
    );
    return text.replace(pattern, (_match, prefix: string, identifier: string) => {
        return `${prefix}${maskWechatIdentifier(identifier, options)}`;
    });
}

export function redactWechatWxids(text: string, options?: WechatRedactionOptions): string {
    if (!text || options?.enabled === false) {
        return text;
    }

    const withBuiltinWxids = text.replace(WXID_PATTERN, (match) => {
        const body = match.slice("wxid_".length);
        if (!body) {
            return match;
        }
        return `wxid_${maskWechatIdentifier(body, options)}`;
    });

    return redactWechatExactMatches(withBuiltinWxids, options);
}

export function redactWechatUnknownText(value: unknown, options?: WechatRedactionOptions): unknown {
    return typeof value === "string" ? redactWechatWxids(value, options) : value;
}
