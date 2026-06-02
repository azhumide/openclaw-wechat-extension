import {
    canonicalWechatChannelId,
    normalizeWechatMessageToolTarget,
} from "./canonicalization.js";

function readWechatContextString(
    ctx: Record<string, unknown> | undefined,
    keys: string[],
): string | undefined {
    for (const key of keys) {
        const value = ctx?.[key];
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }
    return undefined;
}

function readWechatContextBoolean(
    ctx: Record<string, unknown> | undefined,
    keys: string[],
): boolean | undefined {
    for (const key of keys) {
        const value = ctx?.[key];
        if (typeof value === "boolean") {
            return value;
        }
        if (typeof value === "string" && value.trim()) {
            const normalized = value.trim().toLowerCase();
            if (["true", "1", "yes", "y"].includes(normalized)) {
                return true;
            }
            if (["false", "0", "no", "n"].includes(normalized)) {
                return false;
            }
        }
    }
    return undefined;
}

function readWechatContextNestedString(
    ctx: Record<string, unknown> | undefined,
    objectKey: string,
    keys: string[],
): string | undefined {
    const nested = ctx?.[objectKey];
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
        return undefined;
    }
    return readWechatContextString(nested as Record<string, unknown>, keys);
}

function readWechatContextNestedBoolean(
    ctx: Record<string, unknown> | undefined,
    objectKey: string,
    keys: string[],
): boolean | undefined {
    const nested = ctx?.[objectKey];
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
        return undefined;
    }
    return readWechatContextBoolean(nested as Record<string, unknown>, keys);
}

export function resolveWechatContextSessionKey(ctx: Record<string, unknown> | undefined): string | undefined {
    return readWechatContextString(ctx, ["sessionKey", "SessionKey"]);
}

export function resolveWechatContextSenderId(
    ctx: Record<string, unknown> | undefined,
    fallback?: unknown,
): string | undefined {
    return readWechatContextString(ctx, ["senderId", "SenderId"]) ||
        (typeof fallback === "string" && fallback.trim() ? fallback.trim() : undefined);
}

export function resolveWechatContextBody(
    ctx: Record<string, unknown> | undefined,
    fallback?: unknown,
): string | undefined {
    return readWechatContextString(ctx, ["body", "Body", "content", "Content"]) ||
        (typeof fallback === "string" && fallback.trim() ? fallback.trim() : undefined);
}

function resolveWechatContextChatIdFromSessionKey(sessionKey: string | undefined): string | undefined {
    const trimmed = sessionKey?.trim();
    if (!trimmed) {
        return undefined;
    }
    const marker = ":wechat:";
    const markerIndex = trimmed.toLowerCase().indexOf(marker);
    if (markerIndex < 0) {
        return undefined;
    }
    const suffix = trimmed.slice(markerIndex + marker.length);
    const separatorIndex = suffix.indexOf(":");
    if (separatorIndex <= 0) {
        return undefined;
    }
    return suffix.slice(separatorIndex + 1).trim() || undefined;
}

function resolveWechatContextChatType(
    ctx: Record<string, unknown> | undefined,
    sessionKey: string | undefined,
): "group" | "direct" | undefined {
    const raw = readWechatContextString(ctx, ["chatType", "ChatType"])?.toLowerCase();
    if (raw === "group" || raw === "direct") {
        return raw;
    }
    const lowerSessionKey = sessionKey?.toLowerCase() || "";
    if (lowerSessionKey.includes(":wechat:group:")) {
        return "group";
    }
    if (lowerSessionKey.includes(":wechat:direct:")) {
        return "direct";
    }
    return undefined;
}

export function resolveWechatContextChannelAlias(
    ctx: Record<string, unknown> | undefined,
): "wechat" | undefined {
    for (const key of [
        "channel",
        "Channel",
        "agentChannel",
        "AgentChannel",
        "currentChannelProvider",
        "CurrentChannelProvider",
        "OriginatingChannel",
        "Provider",
        "Surface",
    ]) {
        const canonical = canonicalWechatChannelId(ctx?.[key]);
        if (canonical) {
            return canonical;
        }
    }
    return undefined;
}

function resolveWechatMessageToolTargetField(params: Record<string, unknown>): {
    field?: "target" | "to" | "channelId";
    value?: string;
    normalized?: string;
} {
    for (const field of ["target", "to", "channelId"] as const) {
        const value = params[field];
        if (typeof value === "string" && value.trim()) {
            return {
                field,
                value: value.trim(),
                normalized: normalizeWechatMessageToolTarget(value),
            };
        }
    }
    return {};
}

export function hasWechatMessageToolMediaIntent(params: Record<string, unknown>): boolean {
    for (const field of ["media", "mediaUrl", "path", "filePath", "fileUrl"] as const) {
        const value = params[field];
        if (typeof value === "string" && value.trim()) {
            return true;
        }
    }
    if (Array.isArray(params.mediaUrls) && params.mediaUrls.some((value) => typeof value === "string" && value.trim())) {
        return true;
    }
    if (Array.isArray(params.attachments)) {
        for (const attachment of params.attachments) {
            if (!attachment || typeof attachment !== "object" || Array.isArray(attachment)) {
                continue;
            }
            const record = attachment as Record<string, unknown>;
            if (
                ["media", "mediaUrl", "path", "filePath", "fileUrl", "url"].some((field) =>
                    typeof record[field] === "string" && record[field].trim()
                )
            ) {
                return true;
            }
        }
    }
    for (const field of ["message", "text", "content", "caption"] as const) {
        const value = params[field];
        if (typeof value === "string" && /(?:MEDIA|FILE):/i.test(value)) {
            return true;
        }
    }
    return false;
}

export function hasWechatMessageToolTextIntent(params: Record<string, unknown>): boolean {
    for (const field of ["message", "text", "content", "caption"] as const) {
        const value = params[field];
        if (typeof value === "string" && value.trim()) {
            return true;
        }
    }
    return false;
}

export function patchWechatMessageToolChannelField(params: Record<string, unknown>): {
    changed: boolean;
    previousChannel?: string;
    target?: string;
    reason?: string;
} {
    const rawChannel = typeof params.channel === "string" ? params.channel.trim() : "";
    const rawChannelLower = rawChannel.toLowerCase();
    if (!rawChannel) {
        params.channel = "wechat";
        return {
            changed: true,
            previousChannel: rawChannel,
            reason: "missing-channel",
        };
    }

    const channelTargetMatch = rawChannel.match(/^(?:wechatId|wechat|weixin|openclaw-weixin)\s*:\s*(.+)$/i);
    const targetCandidate = channelTargetMatch?.[1]?.trim();
    if (targetCandidate && (
        targetCandidate.endsWith("@chatroom") ||
        targetCandidate.startsWith("wxid_") ||
        /^\d{5,}$/.test(targetCandidate)
    )) {
        params.channel = "wechat";
        if (!resolveWechatMessageToolTargetField(params).value) {
            params.target = targetCandidate;
        }
        return {
            changed: true,
            previousChannel: rawChannel,
            target: targetCandidate,
            reason: "channel-carried-target",
        };
    }

    if (rawChannelLower === "openclaw-weixin" || rawChannelLower === "weixin") {
        params.channel = "wechat";
        return {
            changed: true,
            previousChannel: rawChannel,
            reason: "legacy-channel-alias",
        };
    }

    return {
        changed: false,
    };
}

export function buildWechatMessageToolGroupTargetPatch(params: {
    rawParams: Record<string, unknown>;
    ctx: Record<string, unknown> | undefined;
    sessionKey?: string;
    senderId?: string;
    authContext?: {
        from?: string;
        chatType?: "group" | "direct";
        senderId?: string;
    };
}): {
    target: string;
    previousTarget?: string;
    reason: string;
} | null {
    const action = typeof params.rawParams.action === "string"
        ? params.rawParams.action.trim().toLowerCase()
        : "";
    if (action && action !== "send") {
        return null;
    }

    const chatType = resolveWechatContextChatType(params.ctx, params.sessionKey) || params.authContext?.chatType;
    if (chatType !== "group" && chatType !== "direct") {
        return null;
    }

    const groupTarget =
        readWechatContextString(params.ctx, ["from", "From", "OriginatingTo", "threadId", "ThreadId", "MessageThreadId"]) ||
        params.authContext?.from ||
        resolveWechatContextChatIdFromSessionKey(params.sessionKey);
    if (!groupTarget) {
        return null;
    }

    const targetField = resolveWechatMessageToolTargetField(params.rawParams);
    if (!targetField.value) {
        return {
            target: groupTarget,
            reason: chatType === "group" ? "missing-target" : "missing-direct-target",
        };
    }

    if (chatType === "direct") {
        return null;
    }

    const normalizedTarget = (targetField.normalized || "").trim();
    const normalizedLower = normalizedTarget.toLowerCase();
    const groupTargetLower = groupTarget.trim().toLowerCase();
    if (!normalizedTarget || normalizedLower === groupTargetLower) {
        return null;
    }
    if (normalizedLower.endsWith("@chatroom")) {
        return null;
    }

    const senderId = params.senderId?.trim().toLowerCase() || params.authContext?.senderId?.trim().toLowerCase() || "";
    if (senderId && normalizedLower === senderId) {
        return {
            target: groupTarget,
            previousTarget: targetField.value,
            reason: "sender-direct-target",
        };
    }

    if (normalizedLower.startsWith("wxid_")) {
        return {
            target: groupTarget,
            previousTarget: targetField.value,
            reason: "wxid-direct-target",
        };
    }

    if (hasWechatMessageToolMediaIntent(params.rawParams)) {
        return {
            target: groupTarget,
            previousTarget: targetField.value,
            reason: "group-media-same-conversation",
        };
    }

    return null;
}

export type WechatMessageToolNormalizationResult =
    | { kind: "none" }
    | { kind: "block"; blockReason: string }
    | { kind: "params"; params: Record<string, unknown> };

export function normalizeWechatMessageToolCall(params: {
    rawParams: Record<string, unknown>;
    ctx: Record<string, unknown> | undefined;
    sessionKey?: string;
    senderId?: string;
    authContext?: {
        from?: string;
        chatType?: "group" | "direct";
        senderId?: string;
    };
    logger?: {
        info?: (message: string) => void;
    };
}): WechatMessageToolNormalizationResult {
    const nextParams = { ...params.rawParams };
    let changed = false;
    const channelPatch = patchWechatMessageToolChannelField(nextParams);
    if (channelPatch.changed) {
        changed = true;
        params.logger?.info?.(
            `[WeChat] Auto-normalized message tool channel=wechat session=${params.sessionKey}` +
            `${channelPatch.previousChannel ? ` previous=${channelPatch.previousChannel}` : ""}` +
            `${channelPatch.target ? ` target=${channelPatch.target}` : ""}` +
            `${channelPatch.reason ? ` reason=${channelPatch.reason}` : ""}`,
        );
    }

    const groupTargetPatch = buildWechatMessageToolGroupTargetPatch({
        rawParams: nextParams,
        ctx: params.ctx,
        sessionKey: params.sessionKey,
        senderId: params.senderId,
        authContext: params.authContext,
    });
    if (groupTargetPatch) {
        nextParams.target = groupTargetPatch.target;
        delete nextParams.to;
        delete nextParams.channelId;
        changed = true;
        params.logger?.info?.(
            `[WeChat] Auto-routing message tool to current conversation session=${params.sessionKey || ""} ` +
            `target=${groupTargetPatch.target} reason=${groupTargetPatch.reason}` +
            `${groupTargetPatch.previousTarget ? ` previous=${groupTargetPatch.previousTarget}` : ""}`,
        );
    }

    const action = typeof nextParams.action === "string"
        ? nextParams.action.trim().toLowerCase()
        : "";
    if (
        (!action || action === "send") &&
        !hasWechatMessageToolTextIntent(nextParams) &&
        !hasWechatMessageToolMediaIntent(nextParams)
    ) {
        params.logger?.info?.(
            `[WeChat] Blocking empty message tool call session=${params.sessionKey} ` +
            `paramKeys=${Object.keys(nextParams).join(",")}`,
        );
        return {
            kind: "block",
            blockReason: "NO_REPLY",
        };
    }

    if (changed) {
        return {
            kind: "params",
            params: nextParams,
        };
    }

    return { kind: "none" };
}

function stripWechatAuthorPrefix(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    if (!trimmed) {
        return undefined;
    }
    return trimmed.toLowerCase().startsWith("wechat:")
        ? trimmed.slice("wechat:".length).trim() || undefined
        : trimmed;
}

export function buildWechatToolAuthFromContext(params: {
    ctx: Record<string, unknown> | undefined;
    sessionKey?: string;
    senderId?: string;
    content?: string;
}) {
    const sessionKey = params.sessionKey?.trim().toLowerCase();
    if (!sessionKey || !sessionKey.toLowerCase().includes(":wechat:")) {
        return undefined;
    }

    const ctx = params.ctx;
    const from =
        readWechatContextString(ctx, ["from", "From", "OriginatingTo", "threadId", "ThreadId"]) ||
        resolveWechatContextChatIdFromSessionKey(sessionKey);
    const senderId = stripWechatAuthorPrefix(
        params.senderId ||
        readWechatContextString(ctx, ["senderId", "SenderId"]) ||
        readWechatContextNestedString(ctx, "author", ["id"]),
    ) || from;
    if (!senderId) {
        return undefined;
    }

    return {
        sessionKey,
        from,
        accountId: readWechatContextString(ctx, ["accountId", "AccountId", "to", "To"]) || "default",
        chatType: resolveWechatContextChatType(ctx, sessionKey),
        conversationLabel:
            readWechatContextString(ctx, ["conversationLabel", "ConversationLabel", "groupSubject", "GroupSubject"]) ||
            from,
        senderId,
        senderName:
            readWechatContextString(ctx, ["senderName", "SenderName"]) ||
            readWechatContextNestedString(ctx, "author", ["name"]),
        isMaster:
            readWechatContextBoolean(ctx, ["isMaster", "IsMaster", "senderIsOwner", "SenderIsOwner"]) ??
            readWechatContextNestedBoolean(ctx, "author", ["isMaster", "senderIsOwner"]) ??
            false,
        content: params.content || resolveWechatContextBody(ctx),
        messageId: readWechatContextString(ctx, ["messageId", "MessageSid", "msgId", "MsgId"]),
        createdAt: Date.now(),
    };
}
