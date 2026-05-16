import { Buffer } from "buffer";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { resolveWechatExtensionConfig } from "./config.js";

const WECHAT_MEDIA_DEDUP_SAMPLE_BYTES = 128 * 1024;

export type WechatInboundMediaResolution = {
    mediaPath?: string;
    mediaType?: string;
};

/**
 * 获取 OpenClaw 允许的临时目录，确保媒体文件不会因为路径安全策略被拦截
 */
export function getAllowedWechatTmpDir(
    cfg: Record<string, unknown>,
    logger?: { warn?: (message: string) => void },
): string {
    const bridgeConfig = resolveWechatExtensionConfig(cfg, logger);
    const targetDir = bridgeConfig.tmpDir
        ? path.resolve(bridgeConfig.tmpDir)
        : path.join(bridgeConfig.workspaceBase, "downloads");
    try {
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true, mode: 0o700 });
        }
        fs.accessSync(targetDir, fs.constants.W_OK);
        return targetDir;
    } catch {
        const fallback = path.join(process.cwd(), ".tmp");
        if (!fs.existsSync(fallback)) {
            fs.mkdirSync(fallback, { recursive: true, mode: 0o700 });
        }
        return fallback;
    }
}

export async function resolveWechatInboundMedia(params: {
    media: any;
    cfg: Record<string, unknown>;
    logger: OpenClawPluginApi["logger"];
}): Promise<WechatInboundMediaResolution> {
    const { media, cfg, logger } = params;
    try {
        if (media?.data) {
            const buffer = Buffer.from(media.data, "base64");
            const filename = media.name || `msg-${Date.now()}.bin`;
            const tmpDir = getAllowedWechatTmpDir(cfg, logger);
            const dest = path.join(tmpDir, filename);
            fs.writeFileSync(dest, buffer);
            return {
                mediaPath: dest,
                mediaType: media.mime || "application/octet-stream",
            };
        }

        if (media?.path && typeof media.path === "string") {
            if (media.path.startsWith("http://") || media.path.startsWith("https://")) {
                const filename = media.name ||
                    `remote-${Date.now()}-${path.basename(new URL(media.path).pathname) || "file"}`;
                const tmpDir = getAllowedWechatTmpDir(cfg, logger);
                const dest = path.join(tmpDir, filename);
                logger.info(`[WeChat] Downloading remote media: ${media.path} -> ${dest}`);
                const response = await fetch(media.path);
                if (response.ok) {
                    const buffer = Buffer.from(await response.arrayBuffer());
                    fs.writeFileSync(dest, buffer);
                    return {
                        mediaPath: dest,
                        mediaType: media.mime || response.headers.get("content-type") || "application/octet-stream",
                    };
                }
                logger.error(`[WeChat] Failed to download remote media: ${response.statusText}`);
                return {};
            }

            return {
                mediaPath: media.path,
                mediaType: media.mime || "application/octet-stream",
            };
        }
    } catch (err: any) {
        logger.error(`[WeChat] Media error: ${err.message}`);
    }
    return {};
}

export function resolveWechatBareLocalMediaPath(params: {
    rawLine: string;
    workspaceBase?: string;
}): string | null {
    let candidate = params.rawLine.trim();
    if (!candidate || /^(?:MEDIA|FILE):/i.test(candidate) || /^https?:\/\//i.test(candidate)) {
        return null;
    }

    if (
        (candidate.startsWith("`") && candidate.endsWith("`")) ||
        (candidate.startsWith("\"") && candidate.endsWith("\"")) ||
        (candidate.startsWith("'") && candidate.endsWith("'"))
    ) {
        candidate = candidate.slice(1, -1).trim();
    }

    if (!candidate || /\s/.test(candidate)) {
        return null;
    }

    const looksAbsoluteUnix = candidate.startsWith("/");
    const looksAbsoluteWindows = /^[a-zA-Z]:[\\/]/.test(candidate);
    const looksRelative = candidate.startsWith("./") || candidate.startsWith("../");
    const looksHomeRelative = candidate.startsWith("~/") || candidate.startsWith("~\\");
    const looksBareFilename = /^[^\\/]+\.[A-Za-z0-9]{1,16}$/.test(candidate);

    if (!looksAbsoluteUnix && !looksAbsoluteWindows && !looksRelative && !looksHomeRelative && !looksBareFilename) {
        return null;
    }

    const baseDir = params.workspaceBase?.trim() || process.cwd();
    const expandedHome = looksHomeRelative
        ? path.join(process.env.HOME || process.env.USERPROFILE || "", candidate.slice(2))
        : candidate;
    const resolvedPath = looksAbsoluteUnix || looksAbsoluteWindows
        ? path.resolve(expandedHome)
        : path.resolve(baseDir, expandedHome);

    try {
        if (!fs.existsSync(resolvedPath)) {
            return null;
        }
        const stat = fs.statSync(resolvedPath);
        return stat.isFile() ? resolvedPath : null;
    } catch {
        return null;
    }
}

export function extractWechatBareLocalMediaFromText(params: {
    text: string;
    workspaceBase?: string;
}): {
    text: string;
    mediaPaths: string[];
} {
    if (!params.text.trim()) {
        return {
            text: params.text,
            mediaPaths: [],
        };
    }

    const lines = params.text.split(/\r?\n/);
    const remainingLines: string[] = [];
    const mediaPaths: string[] = [];

    for (const line of lines) {
        const resolvedPath = resolveWechatBareLocalMediaPath({
            rawLine: line,
            workspaceBase: params.workspaceBase,
        });
        if (resolvedPath) {
            mediaPaths.push(resolvedPath);
            continue;
        }
        remainingLines.push(line);
    }

    return {
        text: remainingLines.join("\n").trim(),
        mediaPaths,
    };
}

export function isWechatLocalMediaReference(value: unknown): value is string {
    if (typeof value !== "string") {
        return false;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return false;
    }
    return !/^https?:\/\//i.test(trimmed);
}

const WECHAT_SAFE_LOCAL_ATTACHMENT_EXTENSIONS = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".bmp",
    ".svg",
    ".mp4",
    ".mov",
    ".avi",
    ".webm",
    ".mkv",
    ".mp3",
    ".wav",
    ".ogg",
    ".m4a",
    ".aac",
    ".flac",
    ".amr",
    ".opus",
]);

export function isWechatSafeLocalAttachmentPath(filePath: string): boolean {
    return WECHAT_SAFE_LOCAL_ATTACHMENT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export type WechatMediaCandidate = {
    mediaUrl: string;
    dedupKey: string;
    audioAsVoice?: boolean;
};

export function buildWechatLocalMediaDedupKey(
    filePath: string,
    logger?: OpenClawPluginApi["logger"],
): string {
    const absolutePath = path.resolve(filePath.trim());

    try {
        const stat = fs.statSync(absolutePath);
        const hash = createHash("sha1");
        hash.update(`size:${stat.size};`);

        const fd = fs.openSync(absolutePath, "r");
        try {
            const sampleBytes = Math.min(Number(stat.size), WECHAT_MEDIA_DEDUP_SAMPLE_BYTES);
            if (sampleBytes > 0) {
                const headBuffer = Buffer.alloc(sampleBytes);
                const headRead = fs.readSync(fd, headBuffer, 0, sampleBytes, 0);
                hash.update(headBuffer.subarray(0, headRead));

                if (stat.size > sampleBytes) {
                    const tailBytes = Math.min(
                        Number(stat.size) - sampleBytes,
                        WECHAT_MEDIA_DEDUP_SAMPLE_BYTES,
                    );
                    if (tailBytes > 0) {
                        const tailBuffer = Buffer.alloc(tailBytes);
                        const tailRead = fs.readSync(
                            fd,
                            tailBuffer,
                            0,
                            tailBytes,
                            Number(stat.size) - tailBytes,
                        );
                        hash.update(tailBuffer.subarray(0, tailRead));
                    }
                }
            }
        } finally {
            fs.closeSync(fd);
        }

        return `local:${path.extname(absolutePath).toLowerCase()}:${hash.digest("hex")}`;
    } catch (err: any) {
        logger?.warning?.(
            `[WeChat] Failed to fingerprint local media for dedup; fallback to path key raw=${filePath} resolved=${absolutePath} err=${err?.message || err}`,
        );
        return `local-path:${absolutePath}`;
    }
}

export function buildWechatMediaDedupKey(params: {
    mediaUrl: string;
    logger?: OpenClawPluginApi["logger"];
}): string {
    const trimmed = params.mediaUrl.trim();
    if (!isWechatLocalMediaReference(trimmed)) {
        return `remote:${trimmed}`;
    }
    return buildWechatLocalMediaDedupKey(trimmed, params.logger);
}

export function filterWechatExistingMediaCandidates(params: {
    mediaUrls: string[];
    logger?: OpenClawPluginApi["logger"];
    resolveDedupKey?: (mediaUrl: string) => string;
}): WechatMediaCandidate[] {
    const filtered: WechatMediaCandidate[] = [];
    const seenDedupKeys = new Set<string>();

    for (const mediaUrl of params.mediaUrls) {
        const trimmed = mediaUrl.trim();
        if (!trimmed) {
            continue;
        }
        if (!isWechatLocalMediaReference(trimmed)) {
            const dedupKey = params.resolveDedupKey
                ? params.resolveDedupKey(trimmed)
                : buildWechatMediaDedupKey({ mediaUrl: trimmed, logger: params.logger });
            if (seenDedupKeys.has(dedupKey)) {
                continue;
            }
            seenDedupKeys.add(dedupKey);
            filtered.push({ mediaUrl: trimmed, dedupKey });
            continue;
        }
        const absolutePath = path.resolve(trimmed);
        if (!fs.existsSync(absolutePath)) {
            params.logger?.warning?.(
                `[WeChat] Skipping missing local media candidate before outbound send: raw=${trimmed} resolved=${absolutePath}`,
            );
            continue;
        }
        const dedupKey = params.resolveDedupKey
            ? params.resolveDedupKey(trimmed)
            : buildWechatMediaDedupKey({ mediaUrl: trimmed, logger: params.logger });
        if (seenDedupKeys.has(dedupKey)) {
            params.logger?.info?.(
                `[WeChat] Deduped equivalent local media candidate before outbound send: raw=${trimmed} key=${dedupKey}`,
            );
            continue;
        }
        seenDedupKeys.add(dedupKey);
        filtered.push({ mediaUrl: trimmed, dedupKey });
    }

    return filtered;
}
