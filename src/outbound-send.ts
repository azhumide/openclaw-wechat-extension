import * as fs from "node:fs";
import * as path from "node:path";
import { isPathWithinRoots, resolveWechatExtensionConfig, resolveWechatMediaServeRoots } from "./config.js";
import {
    getWechatRuntime,
    sendToBridge,
} from "./runtime.js";
import { redactWechatWxids } from "./redaction.js";
import { summarizeWechatTextForLog } from "./text.js";
import { uploadWechatLocalMediaToBridge } from "./bridge-media.js";
import {
    buildWechatOutboundMediaDedupKey,
    claimWechatOutboundMediaDedup,
    isWechatBridgeStagedMediaPath,
    releaseWechatOutboundMediaDedup,
    rememberWechatOutboundImageVariant,
    shouldSuppressWechatStagedImageVariant,
    WECHAT_OUTBOUND_MEDIA_DEDUP_TTL_MS,
} from "./outbound-media-dedup.js";

type WechatOutboundRedactionOptions = {
    redactWxidsInOutboundText?: boolean;
    redactWxidsInLogs?: boolean;
    redactExtraWxids?: string[];
};

export function buildWechatOutboundFrame(
    event: "outbound_text" | "outbound_media" | "outbound_reaction",
    payload: Record<string, unknown>,
) {
    return {
        direction: "openclaw_to_bridge",
        event,
        payload,
        ts: Date.now(),
    };
}

export function redactWechatOutboundText(text: string, options: WechatOutboundRedactionOptions): string {
    return redactWechatWxids(text, {
        enabled: options.redactWxidsInOutboundText !== false,
        exactMatches: options.redactExtraWxids,
    });
}

export function summarizeWechatOutboundTextForLog(text: unknown, options: WechatOutboundRedactionOptions): string {
    return summarizeWechatTextForLog(
        typeof text === "string"
            ? redactWechatWxids(text, {
                enabled: options.redactWxidsInLogs !== false,
                exactMatches: options.redactExtraWxids,
            })
            : text,
    );
}

function resolveWechatOutboundCallbackMsgId(params: {
    msg_id?: unknown;
    original_msg_id?: unknown;
}): string {
    return typeof params.original_msg_id === "string" && params.original_msg_id.trim()
        ? params.original_msg_id.trim()
        : (typeof params.msg_id === "string" && params.msg_id.trim() ? params.msg_id.trim() : "");
}

function resolveWechatOutboundTraceId(values: unknown[]): string {
    return values
        .map((value) => typeof value === "string" ? value.trim() : "")
        .find(Boolean) || "";
}

function buildWechatOutboundTextPayload(params: {
    to: unknown;
    text: unknown;
    accountId?: unknown;
    msg_id?: unknown;
    original_msg_id?: unknown;
    messageId?: unknown;
    replyToId?: unknown;
}): Record<string, unknown> {
    const callbackMsgId = resolveWechatOutboundCallbackMsgId(params);
    return {
        type: "text",
        to: params.to,
        text: params.text,
        accountId: params.accountId,
        ...(callbackMsgId ? { msg_id: callbackMsgId } : {}),
        ...(typeof params.original_msg_id === "string" && params.original_msg_id.trim()
            ? { original_msg_id: params.original_msg_id.trim() }
            : {}),
        ...(typeof params.messageId === "string" && params.messageId.trim() ? { messageId: params.messageId.trim() } : {}),
        ...(typeof params.replyToId === "string" && params.replyToId.trim() ? { replyToId: params.replyToId.trim() } : {}),
    };
}

export async function sendWechatOutboundText({
    to,
    text,
    accountId,
    msg_id,
    original_msg_id,
    messageId,
    replyToId,
}: any) {
    const runtime = getWechatRuntime();
    const cfg = runtime?.config.current?.() || {};
    const bridgeConfig = resolveWechatExtensionConfig(cfg, (runtime as any)?.logger ?? console);
    const safeText = redactWechatOutboundText(text, bridgeConfig);
    runtime?.logger?.info?.(
        `[WeChat Outbound] to=${to} account=${accountId || "default"} type=text text="${summarizeWechatOutboundTextForLog(safeText, bridgeConfig)}"`,
    );
    const payload = buildWechatOutboundTextPayload({
        to,
        text: safeText,
        accountId,
        msg_id,
        original_msg_id,
        messageId,
        replyToId,
    });
    const sent = sendToBridge(buildWechatOutboundFrame("outbound_text", payload));
    if (!sent.ok) {
        console.error(`[WeChat] sendText failed: ${sent.error}`);
        return { ok: false, error: new Error(sent.error), channel: "wechat", messageId: "" };
    }
    return { ok: true, channel: "wechat", messageId: `msg-${Date.now()}` };
}

export async function sendWechatOutboundMedia({
    to,
    mediaUrl,
    text,
    accountId,
    msg_id,
    original_msg_id,
    messageId,
    replyToId,
    audioAsVoice,
}: any) {
    const runtime = getWechatRuntime();
    const cfg = runtime.config.current();
    const bridgeConfig = resolveWechatExtensionConfig(cfg, (runtime as any).logger ?? console);
    const safeText = typeof text === "string" ? redactWechatOutboundText(text, bridgeConfig) : text;
    const callbackMsgId = resolveWechatOutboundCallbackMsgId({ msg_id, original_msg_id });
    const traceId = resolveWechatOutboundTraceId([original_msg_id, msg_id, messageId, replyToId]);
    runtime?.logger?.info?.(
        `[WeChat Outbound] to=${to} account=${accountId || "default"} type=media media="${mediaUrl}"` +
        `${audioAsVoice === true ? " audioAsVoice=true" : ""}` +
        `${safeText ? ` text="${summarizeWechatOutboundTextForLog(safeText, bridgeConfig)}"` : ""}`,
    );
    let outboundMediaDedupKey = "";
    let imageVariantKey = "";
    try {
        const serveRoots = resolveWechatMediaServeRoots(cfg, (runtime as any).logger ?? console);
        let resolvedUrl = mediaUrl;

        if (mediaUrl && !mediaUrl.startsWith("http://") && !mediaUrl.startsWith("https://")) {
            let absolutePath = mediaUrl;
            if (!/^(?:[a-zA-Z]:[\\/]|\/)/.test(mediaUrl)) {
                const os = await import("os");
                const workspaceDir = bridgeConfig.workspaceBase || path.join(os.homedir(), ".openclaw", "workspace");
                const candidates = [
                    path.join(workspaceDir, mediaUrl),
                    path.join(workspaceDir, "downloads", mediaUrl),
                    ...bridgeConfig.mediaSearchPaths.map((baseDir) => path.join(baseDir, mediaUrl)),
                ];
                for (const candidate of candidates) {
                    if (fs.existsSync(candidate)) {
                        absolutePath = candidate;
                        break;
                    }
                }
            }

            absolutePath = path.resolve(absolutePath);

            if (!fs.existsSync(absolutePath)) {
                const errorMessage = `Local media path missing before bridge conversion: raw="${mediaUrl}" resolved="${absolutePath}"`;
                runtime?.logger?.warn?.(
                    `[WeChat] ${errorMessage}`,
                );
                return {
                    ok: false,
                    error: new Error(errorMessage),
                    channel: "wechat",
                    messageId: "",
                };
            }

            outboundMediaDedupKey = buildWechatOutboundMediaDedupKey({
                to,
                accountId,
                mediaUrl: absolutePath,
            });
            if (!claimWechatOutboundMediaDedup(outboundMediaDedupKey)) {
                runtime?.logger?.info?.(
                    `[WeChat] Skip duplicate outbound media within ${WECHAT_OUTBOUND_MEDIA_DEDUP_TTL_MS}ms ` +
                    `to=${to} account=${accountId || "default"} trace=${traceId} media="${summarizeWechatTextForLog(absolutePath, 180)}"`,
                );
                return { ok: true, channel: "wechat", messageId: `msg-${Date.now()}` };
            }

            const uploadedUrl = await uploadWechatLocalMediaToBridge({
                filePath: absolutePath,
                config: bridgeConfig,
                logger: (runtime as any).logger ?? console,
            });
            if (uploadedUrl) {
                resolvedUrl = uploadedUrl;
                runtime?.logger?.info?.(
                    `[WeChat] 媒体通过 HTTP 中转发送: ${summarizeWechatTextForLog(absolutePath, 180)}`,
                );
            } else {
                if (fs.existsSync(absolutePath) && !isPathWithinRoots(absolutePath, serveRoots)) {
                    const stageBase = bridgeConfig.tmpDir
                        ? path.resolve(bridgeConfig.tmpDir)
                        : path.join(bridgeConfig.workspaceBase, "downloads");
                    const stageDir = path.join(stageBase, "wechat-bridge-media");
                    fs.mkdirSync(stageDir, { recursive: true });
                    const stagedName = `${Date.now()}_${path.basename(absolutePath)}`;
                    const stagedPath = path.join(stageDir, stagedName);
                    fs.copyFileSync(absolutePath, stagedPath);
                    absolutePath = stagedPath;
                }
                resolvedUrl = absolutePath;
            }

            const imageVariantDecision = shouldSuppressWechatStagedImageVariant({
                to,
                accountId,
                filePath: absolutePath,
                traceId,
            });
            imageVariantKey = imageVariantDecision.variantKey || "";
            if (imageVariantDecision.suppress) {
                runtime?.logger?.info?.(
                    `[WeChat] Suppressing duplicate staged image variant to=${to} account=${accountId || "default"} ` +
                    `trace=${traceId || "none"} media="${summarizeWechatTextForLog(absolutePath, 180)}"`,
                );
                if (safeText) {
                    const textPayload = buildWechatOutboundTextPayload({
                        to,
                        text: safeText,
                        accountId,
                        msg_id,
                        original_msg_id,
                        messageId,
                        replyToId,
                    });
                    const textSent = sendToBridge(buildWechatOutboundFrame("outbound_text", textPayload));
                    if (!textSent.ok) {
                        console.error(`[WeChat] sendText fallback after staged-image suppression failed: ${textSent.error}`);
                        return { ok: false, error: new Error(textSent.error), channel: "wechat", messageId: "" };
                    }
                }
                return { ok: true, channel: "wechat", messageId: `msg-${Date.now()}` };
            }

            const localDirectLog =
                `[WeChat] 媒体路径识别(Local-Direct) to=${to} account=${accountId || "default"} ` +
                `trace=${traceId || "none"} media="${summarizeWechatTextForLog(absolutePath, 180)}"`;
            if (runtime?.logger?.info) {
                runtime.logger.info(localDirectLog);
            } else {
                console.log(localDirectLog);
            }
        } else if (mediaUrl) {
            outboundMediaDedupKey = buildWechatOutboundMediaDedupKey({
                to,
                accountId,
                mediaUrl,
            });
            if (!claimWechatOutboundMediaDedup(outboundMediaDedupKey)) {
                runtime?.logger?.info?.(
                    `[WeChat] Skip duplicate outbound media within ${WECHAT_OUTBOUND_MEDIA_DEDUP_TTL_MS}ms ` +
                    `to=${to} account=${accountId || "default"} trace=${traceId} media="${summarizeWechatTextForLog(mediaUrl, 180)}"`,
                );
                return { ok: true, channel: "wechat", messageId: `msg-${Date.now()}` };
            }
        }

        const payload: any = {
            type: "media",
            to,
            mediaUrl: resolvedUrl,
            text: safeText,
            accountId,
            ...(audioAsVoice === true ? { audioAsVoice: true } : {}),
            ...(callbackMsgId ? { msg_id: callbackMsgId } : {}),
            ...(typeof original_msg_id === "string" && original_msg_id.trim()
                ? { original_msg_id: original_msg_id.trim() }
                : {}),
            ...(typeof messageId === "string" && messageId.trim() ? { messageId: messageId.trim() } : {}),
            ...(typeof replyToId === "string" && replyToId.trim() ? { replyToId: replyToId.trim() } : {}),
        };

        const sent = sendToBridge(buildWechatOutboundFrame("outbound_media", payload));
        if (!sent.ok) {
            if (outboundMediaDedupKey) {
                releaseWechatOutboundMediaDedup(outboundMediaDedupKey);
            }
            console.error(`[WeChat] sendMedia failed: ${sent.error}`);
            return { ok: false, error: new Error(sent.error), channel: "wechat", messageId: "" };
        }
        if (imageVariantKey) {
            rememberWechatOutboundImageVariant(
                imageVariantKey,
                isWechatBridgeStagedMediaPath(resolvedUrl) ? "staged" : "direct",
                traceId,
            );
        }
        const successMessageId = `msg-${Date.now()}`;
        const successLog =
            `[WeChat] sendMedia success to=${to} account=${accountId || "default"} ` +
            `trace=${traceId || "none"} messageId=${successMessageId}`;
        if (runtime?.logger?.info) {
            runtime.logger.info(successLog);
        } else {
            console.log(successLog);
        }
        return { ok: true, channel: "wechat", messageId: successMessageId };
    } catch (error) {
        if (outboundMediaDedupKey) {
            releaseWechatOutboundMediaDedup(outboundMediaDedupKey);
        }
        throw error;
    }
}
