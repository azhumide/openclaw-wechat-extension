import * as path from "node:path";
import type { WechatInboundMediaResolution } from "./media.js";
import { summarizeWechatTextForLog } from "./text.js";

export type WechatInboundContext = {
    from: string;
    fromName?: string;
    content: string;
    accountId: string;
    media?: any;
    groupName?: string;
    senderId?: string;
    senderName?: string;
    isGroup: boolean;
    chatType: "group" | "direct";
    isMaster: boolean;
    messageId: string;
    upstreamMessageTraceId?: string;
    resolvedSenderId: string;
    resolvedSenderName: string;
    conversationLabel: string;
    sessionChatKey: string;
    sessionKey: string;
    ctx: any;
};

export function buildWechatInboundContext(params: {
    body: any;
    media: WechatInboundMediaResolution;
}): WechatInboundContext {
    const {
        from,
        fromName,
        content,
        accountId,
        media,
        groupName,
        senderId,
        senderName,
        isGroup: isGroupPayload,
        isMaster: isMasterPayload,
    } = params.body;

    const isGroup = (() => {
        if (from.endsWith("@chatroom")) return true;
        if (from.startsWith("wxid_")) return false;
        if (typeof isGroupPayload === "boolean") return isGroupPayload;
        return false;
    })();

    const chatType = isGroup ? "group" : "direct";
    const isMaster = isMasterPayload === true;
    const messageId = params.body?.messageId ? String(params.body.messageId) : `msg-${Date.now()}`;
    const upstreamMessageTraceId = [
        params.body?.original_msg_id,
        params.body?.msg_id,
        params.body?.originalMsgId,
        params.body?.msgId,
    ]
        .map((value) => value == null ? "" : String(value).trim())
        .find(Boolean);
    const resolvedSenderId = senderId || from;
    const resolvedSenderName = senderName || fromName || "User";
    const conversationLabel = isGroup ? (groupName || fromName || from) : resolvedSenderName;
    // Direct bridge callbacks may use a delivery alias in `from`; senderId is
    // the stable WeChat identity. Keep `from` for delivery, not session state.
    const sessionChatKey = (isGroup ? from : resolvedSenderId).trim().toLowerCase();
    const sessionKey = `agent:main:wechat:${chatType}:${sessionChatKey}`;
    const mediaPath = params.media.mediaPath;
    const mediaType = params.media.mediaType;
    const commandText = content || "";
    const isTextSlashCommand = commandText.trimStart().startsWith("/");
    const commandAuthorized = isTextSlashCommand && isMaster;

    const peer = {
        id: sessionChatKey,
        kind: isGroup ? ("group" as const) : ("dm" as const),
    };

    const ctx: any = {
        channel: "wechat",
        accountId: accountId || "default",
        source: `wechat:${sessionChatKey}`,
        OriginatingChannel: "wechat",
        OriginatingTo: from,
        Provider: "wechat",
        Surface: "wechat",
        peer,
        author: {
            id: `wechat:${resolvedSenderId}`,
            name: resolvedSenderName,
            isBot: false,
            isMaster,
        },
        conversationLabel,
        ConversationLabel: conversationLabel,
        groupSubject: isGroup ? (groupName || fromName || from) : undefined,
        GroupSubject: isGroup ? (groupName || fromName || from) : undefined,
        senderName: resolvedSenderName,
        SenderName: resolvedSenderName,
        senderId: resolvedSenderId,
        SenderId: resolvedSenderId,
        ownerAllowFrom: isMaster ? [resolvedSenderId] : undefined,
        OwnerAllowFrom: isMaster ? [resolvedSenderId] : undefined,
        isMaster,
        IsMaster: isMaster,
        senderIsOwner: isMaster,
        SenderIsOwner: isMaster,
        WeChatSenderRole: isMaster ? "owner" : "non-owner",
        WeChatAddressingInstruction: isMaster
            ? "This WeChat sender is the owner. Owner-style address terms are allowed."
            : "This WeChat sender is not the owner. Do not address this sender as Boss, boss, 主人, 老板, or 老大; use their senderName or a neutral address instead.",
        messageId,
        originalMsgId: upstreamMessageTraceId,
        OriginalMsgId: upstreamMessageTraceId,
        original_msg_id: upstreamMessageTraceId,
        MessageSid: messageId,
        MessageSidFull: messageId,
        from,
        From: from,
        to: accountId || "default",
        To: accountId || "default",
        isGroup,
        chatType,
        ChatType: chatType,
        sessionKey,
        SessionKey: sessionKey,
        threadId: sessionChatKey,
        ThreadId: sessionChatKey,
        MessageThreadId: sessionChatKey,
        content: content || "",
        body: content || "",
        Body: content || "",
        rawBody: content || "",
        RawBody: content || "",
        bodyForAgent: content || "",
        BodyForAgent: content || "",
        bodyForCommands: commandText,
        BodyForCommands: commandText,
        commandBody: commandText,
        CommandBody: commandText,
        commandSource: isTextSlashCommand ? "text" : undefined,
        CommandSource: isTextSlashCommand ? "text" : undefined,
        commandAuthorized,
        CommandAuthorized: commandAuthorized,
        commandTurn: isTextSlashCommand
            ? {
                kind: "text-slash",
                source: "text",
                authorized: commandAuthorized,
                body: commandText,
            }
            : {
                kind: "normal",
                source: "message",
                authorized: false,
                body: commandText,
            },
        CommandTurn: isTextSlashCommand
            ? {
                kind: "text-slash",
                source: "text",
                authorized: commandAuthorized,
                body: commandText,
            }
            : {
                kind: "normal",
                source: "message",
                authorized: false,
                body: commandText,
            },
        msgId: messageId,
        MsgId: messageId,
        mediaPath,
        MediaPath: mediaPath,
        mediaType,
        MediaType: mediaType,
        mediaPaths: mediaPath ? [mediaPath] : undefined,
        MediaPaths: mediaPath ? [mediaPath] : undefined,
        mediaUrls: (media && typeof media.path === "string" && media.path.startsWith("http")) ? [media.path] : undefined,
        MediaUrls: (media && typeof media.path === "string" && media.path.startsWith("http")) ? [media.path] : undefined,
        mediaTypes: mediaType ? [mediaType] : undefined,
        MediaTypes: mediaType ? [mediaType] : undefined,
        images: mediaPath && mediaType?.startsWith("image/") ? [mediaPath] : undefined,
        Images: mediaPath && mediaType?.startsWith("image/") ? [mediaPath] : undefined,
        files: mediaPath ? [{
            path: mediaPath,
            mime: mediaType || "application/octet-stream",
            name: path.basename(mediaPath)
        }] : undefined,
        Files: mediaPath ? [{
            path: mediaPath,
            mime: mediaType || "application/octet-stream",
            name: path.basename(mediaPath)
        }] : undefined,
        msg: {
            date: Date.now(),
            chat: { id: sessionChatKey, type: chatType },
            text: content || "",
            from: { id: senderId || from, first_name: senderName || fromName || "User" },
        },
    };

    return {
        from,
        fromName,
        content: content || "",
        accountId: accountId || "default",
        media,
        groupName,
        senderId,
        senderName,
        isGroup,
        chatType,
        isMaster,
        messageId,
        upstreamMessageTraceId,
        resolvedSenderId,
        resolvedSenderName,
        conversationLabel,
        sessionChatKey,
        sessionKey,
        ctx,
    };
}

export function buildWechatInboundLogLine(params: {
    inbound: WechatInboundContext;
    buildMarker: string;
}): string {
    const { inbound } = params;
    const inboundTextPreview = summarizeWechatTextForLog(inbound.content);
    const inboundMediaSummary = inbound.media
        ? `media=${inbound.media.mime || inbound.media.type || "unknown"}:${inbound.media.name || inbound.media.path || "[inline]"}`
        : "";
    const conversationNameSummary = inbound.conversationLabel && inbound.conversationLabel !== inbound.from
        ? ` conversation="${summarizeWechatTextForLog(inbound.conversationLabel, 80)}"`
        : "";
    const senderNameSummary = inbound.resolvedSenderName && inbound.resolvedSenderName !== inbound.resolvedSenderId
        ? ` senderName="${summarizeWechatTextForLog(inbound.resolvedSenderName, 80)}"`
        : "";
    return (
        `[WeChat Inbound] from=${inbound.from} sender=${inbound.resolvedSenderId} ` +
        `chatType=${inbound.chatType} isMaster=${inbound.isMaster} msgId=${inbound.messageId}` +
        ` session=${inbound.sessionKey} build=${params.buildMarker}` +
        `${conversationNameSummary}` +
        `${senderNameSummary}` +
        `${inboundTextPreview ? ` text="${inboundTextPreview}"` : ""}` +
        `${inboundMediaSummary ? ` ${inboundMediaSummary}` : ""}`
    );
}
