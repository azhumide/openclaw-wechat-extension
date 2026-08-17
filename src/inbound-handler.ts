import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { resolveWechatExtensionConfig } from "./config.js";
import { sendWechatToolAuthNotice } from "./dedup.js";
import { buildWechatInboundContext, buildWechatInboundLogLine } from "./inbound-context.js";
import { resolveWechatInboundMedia } from "./media.js";
import { dispatchWechatReplyForInbound } from "./reply-delivery.js";
import { enqueueWechatInboundToolAuth } from "./runtime.js";
import { maybeHandleWechatBlockedSkillIntent } from "./blocked-skill-intent.js";

export const WECHAT_EXTENSION_BUILD_MARKER =
    "wechat-announce-final-text-direct-20260703";

export async function handleInboundMessage(api: OpenClawPluginApi, body: any): Promise<void> {
    const logBody = { ...body };
    if (logBody.media?.data) {
        logBody.media = { ...logBody.media, data: `[base64 data, length: ${logBody.media.data.length}]` };
    }
    // api.logger.debug(`[WeChat] Inbound WS message: ${JSON.stringify(logBody)}`);
    const {
        from,
        content,
        accountId,
        media,
    } = body;

    const runtime = api.runtime;
    const cfg = (typeof runtime?.config?.current === "function" ? runtime.config.current() : (api as any)?.config) || {};

    if (runtime.channel.activity?.record) {
        runtime.channel.activity.record({
            channel: "wechat",
            accountId: accountId || "default",
            direction: "inbound",
        });
    }

    if (!from || (!content && !media)) {
        throw new Error("Missing from or content/media");
    }

    const resolvedMedia = media
        ? await resolveWechatInboundMedia({
            media,
            cfg: cfg as Record<string, unknown>,
            logger: api.logger,
        })
        : {};
    const inbound = buildWechatInboundContext({
        body,
        media: resolvedMedia,
    });
    const {
        chatType,
        conversationLabel,
        ctx,
        isMaster,
        messageId,
        resolvedSenderId,
        resolvedSenderName,
        sessionChatKey,
        sessionKey,
    } = inbound;
    api.logger.info(buildWechatInboundLogLine({
        inbound,
        buildMarker: WECHAT_EXTENSION_BUILD_MARKER,
    }));

    enqueueWechatInboundToolAuth({
        sessionKey,
        from,
        accountId: accountId || "default",
        chatType,
        conversationLabel,
        senderId: resolvedSenderId,
        senderName: resolvedSenderName,
        isMaster,
        content: content || "",
        messageId,
        createdAt: Date.now(),
    });

    const bridgeConfig = resolveWechatExtensionConfig(cfg, api.logger);
    if (await maybeHandleWechatBlockedSkillIntent({
        api,
        bridgeConfig,
        inbound,
        sendWechatToolAuthNotice,
    })) {
        return;
    }

    await dispatchWechatReplyForInbound({
        api,
        runtime,
        cfg,
        inbound,
        sendWechatToolAuthNotice,
    });
}
