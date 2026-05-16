import {
    jsonResult,
    readReactionParams,
    readStringParam,
    resolveReactionMessageId,
} from "openclaw/plugin-sdk/channel-actions";
import { resolveWechatExtensionConfig } from "./config.js";
import {
    getWechatRuntime,
    sendToBridge,
} from "./runtime.js";
import {
    buildWechatOutboundFrame,
    redactWechatOutboundText,
    summarizeWechatOutboundTextForLog,
} from "./outbound-send.js";

const WECHAT_REACTION_FALLBACK_MODE = "emoji-message-fallback";

export async function handleWechatReactionAction({ action, params, accountId, toolContext }: any) {
    if (action !== "react") {
        throw new Error(`Action ${action} is not supported for provider wechat.`);
    }

    const runtime = getWechatRuntime();
    const cfg = runtime?.config.current?.() || {};
    const bridgeConfig = resolveWechatExtensionConfig(cfg, (runtime as any)?.logger ?? console);
    const to = readStringParam(params, "to") ?? readStringParam(params, "target", { required: true });
    const { emoji, remove, isEmpty } = readReactionParams(params, {
        removeErrorMessage: "Emoji is required to remove a WeChat reaction.",
    });

    if (remove) {
        throw new Error("WeChat reaction removal is not supported by the current bridge.");
    }
    if (isEmpty) {
        throw new Error("WeChat react requires emoji parameter.");
    }

    const reactionMessageIdRaw = resolveReactionMessageId({
        args: params,
        toolContext: {
            currentMessageId: toolContext?.currentMessageId ?? undefined,
        },
    });
    const reactionMessageId =
        reactionMessageIdRaw != null ? String(reactionMessageIdRaw).trim() || undefined : undefined;
    const safeEmoji = redactWechatOutboundText(emoji, bridgeConfig);

    runtime?.logger?.info?.(
        `[WeChat Action] action=react to=${to} account=${accountId || "default"}` +
        `${reactionMessageId ? ` messageId=${reactionMessageId}` : ""}` +
        ` emoji="${summarizeWechatOutboundTextForLog(safeEmoji, bridgeConfig)}"` +
        ` mode=${WECHAT_REACTION_FALLBACK_MODE}`,
    );

    const payload = {
        type: "reaction",
        to,
        emoji: safeEmoji,
        text: safeEmoji,
        accountId,
        ...(reactionMessageId ? { messageId: reactionMessageId } : {}),
        mode: WECHAT_REACTION_FALLBACK_MODE,
    };

    const sent = sendToBridge(buildWechatOutboundFrame("outbound_reaction", payload));
    if (!sent.ok) {
        throw new Error(sent.error);
    }

    return jsonResult({
        ok: true,
        added: emoji,
        to,
        ...(reactionMessageId ? { messageId: reactionMessageId } : {}),
        mode: WECHAT_REACTION_FALLBACK_MODE,
    });
}
