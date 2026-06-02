import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

export const WECHAT_OUTBOUND_MEDIA_DEDUP_TTL_MS = 90_000;
const WECHAT_OUTBOUND_MEDIA_DEDUP_SAMPLE_BYTES = 128 * 1024;
const recentOutboundMediaAt = new Map<string, number>();
const WECHAT_OUTBOUND_IMAGE_VARIANT_TTL_MS = 90_000;
const WECHAT_OUTBOUND_IMAGE_EXTENSIONS = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".bmp",
]);
const recentOutboundImageVariants = new Map<
    string,
    { seenAt: number; source: "direct" | "staged"; traceId?: string }
>();

function pruneWechatOutboundMediaDedupCache(now = Date.now()) {
    for (const [dedupKey, seenAt] of recentOutboundMediaAt) {
        if (now - seenAt > WECHAT_OUTBOUND_MEDIA_DEDUP_TTL_MS) {
            recentOutboundMediaAt.delete(dedupKey);
        }
    }
}

export function claimWechatOutboundMediaDedup(dedupKey: string): boolean {
    const now = Date.now();
    pruneWechatOutboundMediaDedupCache(now);
    const seenAt = recentOutboundMediaAt.get(dedupKey);
    if (typeof seenAt === "number" && now - seenAt < WECHAT_OUTBOUND_MEDIA_DEDUP_TTL_MS) {
        return false;
    }
    recentOutboundMediaAt.set(dedupKey, now);
    return true;
}

export function releaseWechatOutboundMediaDedup(dedupKey: string) {
    recentOutboundMediaAt.delete(dedupKey);
}

function pruneWechatOutboundImageVariantCache(now = Date.now()) {
    for (const [variantKey, entry] of recentOutboundImageVariants) {
        if (now - entry.seenAt > WECHAT_OUTBOUND_IMAGE_VARIANT_TTL_MS) {
            recentOutboundImageVariants.delete(variantKey);
        }
    }
}

export function isWechatBridgeStagedMediaPath(filePath: string): boolean {
    const absolutePath = path.resolve(filePath.trim());
    return absolutePath.split(path.sep).some((segment) => segment.toLowerCase() === "wechat-bridge-media");
}

function normalizeWechatImageVariantStem(filePath: string): string | null {
    const absolutePath = path.resolve(filePath.trim());
    const ext = path.extname(absolutePath).toLowerCase();
    if (!WECHAT_OUTBOUND_IMAGE_EXTENSIONS.has(ext)) {
        return null;
    }

    let stem = path.basename(absolutePath, ext).toLowerCase();
    stem = stem.replace(/^\d{10,}_/, "");
    stem = stem.replace(/---[0-9a-f-]{8,}$/i, "");
    stem = stem.replace(/[_\s-]+/g, "_").replace(/^_+|_+$/g, "");
    return stem || null;
}

function buildWechatOutboundImageVariantKey(params: {
    to: string;
    filePath: string;
    accountId?: string;
}): string | null {
    const imageStem = normalizeWechatImageVariantStem(params.filePath);
    if (!imageStem) {
        return null;
    }
    return [
        `to:${params.to.trim()}`,
        `account:${(params.accountId || "default").trim() || "default"}`,
        `image-family:${imageStem}`,
    ].join("|");
}

function getRecentWechatOutboundImageVariant(variantKey: string) {
    const now = Date.now();
    pruneWechatOutboundImageVariantCache(now);
    const entry = recentOutboundImageVariants.get(variantKey);
    if (!entry) {
        return undefined;
    }
    if (now - entry.seenAt > WECHAT_OUTBOUND_IMAGE_VARIANT_TTL_MS) {
        recentOutboundImageVariants.delete(variantKey);
        return undefined;
    }
    return entry;
}

export function rememberWechatOutboundImageVariant(
    variantKey: string,
    source: "direct" | "staged",
    traceId?: string,
) {
    recentOutboundImageVariants.set(variantKey, {
        seenAt: Date.now(),
        source,
        traceId: traceId?.trim() || undefined,
    });
}

export function shouldSuppressWechatStagedImageVariant(params: {
    to: string;
    accountId?: string;
    filePath: string;
    traceId?: string;
}): { suppress: boolean; variantKey?: string } {
    const variantKey = buildWechatOutboundImageVariantKey({
        to: params.to,
        accountId: params.accountId,
        filePath: params.filePath,
    });
    if (!variantKey) {
        return { suppress: false };
    }
    if (!isWechatBridgeStagedMediaPath(params.filePath)) {
        return { suppress: false, variantKey };
    }

    const recent = getRecentWechatOutboundImageVariant(variantKey);
    if (!recent || recent.source !== "direct") {
        return { suppress: false, variantKey };
    }

    return { suppress: true, variantKey };
}

function buildWechatLocalMediaFingerprint(filePath: string): string {
    const absolutePath = path.resolve(filePath.trim());
    const stat = fs.statSync(absolutePath);
    const hash = createHash("sha1");
    hash.update(`size:${stat.size};`);

    const fd = fs.openSync(absolutePath, "r");
    try {
        const headBytes = Math.min(Number(stat.size), WECHAT_OUTBOUND_MEDIA_DEDUP_SAMPLE_BYTES);
        if (headBytes > 0) {
            const headBuffer = Buffer.alloc(headBytes);
            const headRead = fs.readSync(fd, headBuffer, 0, headBytes, 0);
            hash.update(headBuffer.subarray(0, headRead));

            if (stat.size > headBytes) {
                const tailBytes = Math.min(Number(stat.size) - headBytes, WECHAT_OUTBOUND_MEDIA_DEDUP_SAMPLE_BYTES);
                if (tailBytes > 0) {
                    const tailBuffer = Buffer.alloc(tailBytes);
                    const tailRead = fs.readSync(fd, tailBuffer, 0, tailBytes, Number(stat.size) - tailBytes);
                    hash.update(tailBuffer.subarray(0, tailRead));
                }
            }
        }
    } finally {
        fs.closeSync(fd);
    }

    return `local:${path.extname(absolutePath).toLowerCase()}:${hash.digest("hex")}`;
}

export function buildWechatOutboundMediaDedupKey(params: {
    to: string;
    mediaUrl: string;
    accountId?: string;
}): string {
    const trimmedMedia = params.mediaUrl.trim();
    const mediaFingerprint =
        /^https?:\/\//i.test(trimmedMedia)
            ? `remote:${trimmedMedia}`
            : buildWechatLocalMediaFingerprint(trimmedMedia);

    return [
        `to:${params.to.trim()}`,
        `account:${(params.accountId || "default").trim() || "default"}`,
        mediaFingerprint,
    ].join("|");
}
