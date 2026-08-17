const WECHAT_CHANNEL_IDS = new Set(["wechat", "openclaw-weixin", "weixin", "wechatid"]);

export function canonicalWechatChannelId(value: unknown): "wechat" | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    return WECHAT_CHANNEL_IDS.has(value.trim().toLowerCase()) ? "wechat" : undefined;
}
