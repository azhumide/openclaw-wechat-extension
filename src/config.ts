import * as fs from "fs";
import * as os from "os";
import * as path from "path";

type LoggerLike = {
    warn?: (message: string) => void;
};

type PartialWechatExtensionConfig = {
    wsHost?: string;
    wsPort?: number;
    wsPath?: string;
    bridgeDownloadHost?: string;
    bridgeDownloadBaseUrl?: string;
    workspaceBase?: string;
    tmpDir?: string;
    mediaSearchPaths?: string[];
};

export type WechatExtensionConfig = {
    wsHost: string;
    wsPort: number;
    wsPath: string;
    bridgeDownloadHost: string;
    bridgeDownloadBaseUrl: string;
    workspaceBase: string;
    tmpDir: string;
    mediaSearchPaths: string[];
};

export const WECHAT_LOCAL_CONFIG_PATH = new URL("../wechat.config.json", import.meta.url);

let cachedConfig: PartialWechatExtensionConfig | null = null;
let cachedMtimeMs = -1;

function normalizeString(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed || undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const normalized = value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
    return normalized.length > 0 ? normalized : undefined;
}

function normalizeWsPath(value: unknown): string | undefined {
    const raw = normalizeString(value);
    if (!raw) return undefined;
    return raw.startsWith("/") ? raw : `/${raw}`;
}

function normalizeBaseUrl(value: unknown): string | undefined {
    const raw = normalizeString(value);
    if (!raw) return undefined;
    const normalized = raw.replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(normalized)) return undefined;
    return normalized;
}

function normalizePort(value: unknown): number | undefined {
    if (value === null || value === undefined || value === "") return undefined;
    const port = Number(value);
    if (!Number.isFinite(port) || port <= 0) return undefined;
    return port;
}

function sanitizeLocalConfig(raw: unknown): PartialWechatExtensionConfig {
    if (!raw || typeof raw !== "object") return {};
    const source = raw as Record<string, unknown>;
    return {
        wsHost: normalizeString(source.wsHost),
        wsPort: normalizePort(source.wsPort),
        wsPath: normalizeWsPath(source.wsPath),
        bridgeDownloadHost: normalizeString(source.bridgeDownloadHost),
        bridgeDownloadBaseUrl: normalizeBaseUrl(source.bridgeDownloadBaseUrl),
        workspaceBase: normalizeString(source.workspaceBase),
        tmpDir: normalizeString(source.tmpDir),
        mediaSearchPaths: normalizeStringArray(source.mediaSearchPaths),
    };
}

export function loadWechatLocalConfig(logger?: LoggerLike): PartialWechatExtensionConfig {
    try {
        const stat = fs.statSync(WECHAT_LOCAL_CONFIG_PATH);
        if (cachedConfig && cachedMtimeMs === stat.mtimeMs) {
            return cachedConfig;
        }
        const raw = fs.readFileSync(WECHAT_LOCAL_CONFIG_PATH, "utf-8");
        cachedConfig = sanitizeLocalConfig(JSON.parse(raw));
        cachedMtimeMs = stat.mtimeMs;
        return cachedConfig;
    } catch (error: any) {
        if (error?.code !== "ENOENT") {
            logger?.warn?.(`[WeChat] Failed to load local config ${WECHAT_LOCAL_CONFIG_PATH.pathname}: ${error.message}`);
        }
        cachedConfig = {};
        cachedMtimeMs = -1;
        return cachedConfig;
    }
}

export function resolveWechatExtensionConfig(cfg: any, logger?: LoggerLike): WechatExtensionConfig {
    const root = cfg?.channels?.wechat || {};
    const local = loadWechatLocalConfig(logger);

    const wsHost = normalizeString(root.wsHost) || local.wsHost || "0.0.0.0";
    const wsPort = normalizePort(root.wsPort) || local.wsPort || 9093;
    const wsPath = normalizeWsPath(root.wsPath) || local.wsPath || "/ws";
    const bridgeDownloadHost =
        normalizeString(root.bridgeDownloadHost) ||
        local.bridgeDownloadHost ||
        "127.0.0.1";
    const bridgeDownloadBaseUrl =
        normalizeBaseUrl(root.bridgeDownloadBaseUrl) ||
        local.bridgeDownloadBaseUrl ||
        "";
    const workspaceBase =
        normalizeString(root.workspaceBase) ||
        local.workspaceBase ||
        normalizeString(cfg?.agents?.defaults?.workspace) ||
        normalizeString(process.env.OPENCLAW_WORKSPACE) ||
        path.join(os.homedir(), ".openclaw", "workspace");
    const tmpDir =
        normalizeString(root.tmpDir) ||
        local.tmpDir ||
        "";
    const mediaSearchPaths =
        normalizeStringArray(root.mediaSearchPaths) ||
        local.mediaSearchPaths ||
        [];

    return {
        wsHost,
        wsPort,
        wsPath,
        bridgeDownloadHost,
        bridgeDownloadBaseUrl,
        workspaceBase,
        tmpDir,
        mediaSearchPaths,
    };
}

export function resolveWechatMediaServeRoots(cfg: any, logger?: LoggerLike): string[] {
    const bridgeConfig = resolveWechatExtensionConfig(cfg, logger);
    const roots = new Set<string>();

    const pushRoot = (candidate?: string) => {
        const normalized = normalizeString(candidate);
        if (!normalized) return;
        roots.add(path.resolve(normalized));
    };

    pushRoot(bridgeConfig.workspaceBase);
    pushRoot(path.join(bridgeConfig.workspaceBase, "downloads"));
    pushRoot(bridgeConfig.tmpDir);
    for (const candidate of bridgeConfig.mediaSearchPaths) {
        pushRoot(candidate);
    }

    return [...roots];
}

export function isPathWithinRoots(filePath: string, roots: string[]): boolean {
    const resolvedFile = path.resolve(filePath);
    return roots.some((root) => {
        const resolvedRoot = path.resolve(root);
        const relative = path.relative(resolvedRoot, resolvedFile);
        return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
    });
}
