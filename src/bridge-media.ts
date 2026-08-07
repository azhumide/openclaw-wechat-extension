import * as fs from "node:fs";
import * as path from "node:path";
import type { WechatExtensionConfig } from "./config.js";

function guessMediaType(filePath: string): string {
    switch (path.extname(filePath).toLowerCase()) {
        case ".jpg":
        case ".jpeg":
            return "image/jpeg";
        case ".png":
            return "image/png";
        case ".gif":
            return "image/gif";
        case ".webp":
            return "image/webp";
        case ".mp3":
            return "audio/mpeg";
        case ".wav":
            return "audio/wav";
        case ".amr":
            return "audio/amr";
        case ".m4a":
            return "audio/mp4";
        case ".ogg":
            return "audio/ogg";
        case ".opus":
            return "audio/opus";
        case ".mp4":
            return "video/mp4";
        case ".mov":
            return "video/quicktime";
        default:
            return "application/octet-stream";
    }
}

export async function uploadWechatLocalMediaToBridge(params: {
    filePath: string;
    config: WechatExtensionConfig;
    logger?: { warn?: (message: string) => void; info?: (message: string) => void };
}): Promise<string | null> {
    const baseUrl = params.config.bridgeDownloadBaseUrl?.trim().replace(/\/$/, "");
    const accessToken = params.config.bridgeMediaToken?.trim();
    if (!baseUrl || !accessToken) {
        return null;
    }

    let stat: fs.Stats;
    try {
        stat = fs.statSync(params.filePath);
    } catch (error: any) {
        params.logger?.warn?.(`[WeChat] Failed to inspect local media before HTTP upload: ${error.message}`);
        return null;
    }
    if (!stat.isFile()) {
        return null;
    }

    const filename = encodeURIComponent(path.basename(params.filePath));
    try {
        const response = await fetch(`${baseUrl}/api/bridge-media`, {
            method: "PUT",
            headers: {
                "X-AiBot-Media-Token": accessToken,
                "X-AiBot-Media-Filename": filename,
                "Content-Type": guessMediaType(params.filePath),
                "Content-Length": String(stat.size),
            },
            body: fs.createReadStream(params.filePath) as any,
            duplex: "half",
        } as RequestInit & { duplex: "half" });

        if (!response.ok) {
            const responseText = (await response.text()).slice(0, 240);
            params.logger?.warn?.(
                `[WeChat] HTTP media upload failed: ${response.status} ${response.statusText} ${responseText}`,
            );
            return null;
        }

        const result = await response.json() as { url?: unknown };
        if (typeof result.url !== "string" || !result.url.startsWith("http")) {
            params.logger?.warn?.("[WeChat] HTTP media upload returned no usable URL");
            return null;
        }
        params.logger?.info?.(`[WeChat] Local media uploaded over HTTP: ${path.basename(params.filePath)}`);
        return result.url;
    } catch (error: any) {
        params.logger?.warn?.(`[WeChat] HTTP media upload exception: ${error.message}`);
        return null;
    }
}
