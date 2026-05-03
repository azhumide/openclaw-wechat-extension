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
    nonOwnerToolAuthMode?: "off" | "deny" | "approve";
    nonOwnerToolAuthTools?: string[];
    toolAuthBypassWxids?: string[];
    toolAuthBypassByTool?: Record<string, string[]>;
    toolAuthBlockedSkills?: string[];
    toolAuthAllowInstalledSkills?: boolean;
    toolAuthDebugInstalledSkills?: boolean;
    ownerExecBypassApproval?: boolean;
    toolAuthNotifyBlocked?: boolean;
    toolAuthNotifyApprovalQueued?: boolean;
    toolAuthNotifyApprovalResolved?: boolean;
    toolAuthNotifyInGroup?: boolean;
    toolAuthNotifyInDirect?: boolean;
    toolAuthMessageBlocked?: string;
    toolAuthMessageQueued?: string;
    toolAuthMessageAllowOnce?: string;
    toolAuthMessageAllowAlways?: string;
    toolAuthMessageDeny?: string;
    toolAuthMessageTimeout?: string;
    toolAuthMessageCancelled?: string;
    redactWxidsInOutboundText?: boolean;
    redactWxidsInLogs?: boolean;
    redactExtraWxids?: string[];
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
    nonOwnerToolAuthMode: "off" | "deny" | "approve";
    nonOwnerToolAuthTools: string[];
    toolAuthBypassWxids: string[];
    toolAuthBypassByTool: Record<string, string[]>;
    toolAuthBlockedSkills: string[];
    toolAuthAllowInstalledSkills: boolean;
    toolAuthDebugInstalledSkills: boolean;
    ownerExecBypassApproval: boolean;
    toolAuthNotifyBlocked: boolean;
    toolAuthNotifyApprovalQueued: boolean;
    toolAuthNotifyApprovalResolved: boolean;
    toolAuthNotifyInGroup: boolean;
    toolAuthNotifyInDirect: boolean;
    toolAuthMessageBlocked?: string;
    toolAuthMessageQueued?: string;
    toolAuthMessageAllowOnce?: string;
    toolAuthMessageAllowAlways?: string;
    toolAuthMessageDeny?: string;
    toolAuthMessageTimeout?: string;
    toolAuthMessageCancelled?: string;
    redactWxidsInOutboundText: boolean;
    redactWxidsInLogs: boolean;
    redactExtraWxids: string[];
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

function normalizeToolAuthBypassByTool(value: unknown): Record<string, string[]> | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return undefined;
    }
    const source = value as Record<string, unknown>;
    const normalizedEntries = Object.entries(source)
        .map(([toolName, toolAllowList]) => {
            const key = toolName.trim().toLowerCase();
            const allowList = normalizeStringArray(toolAllowList);
            if (!key || !allowList) {
                return undefined;
            }
            return [key, allowList] as const;
        })
        .filter((entry): entry is readonly [string, string[]] => Boolean(entry));

    if (normalizedEntries.length === 0) {
        return undefined;
    }

    return Object.fromEntries(normalizedEntries);
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

function normalizeBoolean(value: unknown): boolean | undefined {
    if (typeof value === "boolean") return value;
    if (typeof value !== "string") return undefined;
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    return undefined;
}

function normalizeNonOwnerToolAuthMode(value: unknown): "off" | "deny" | "approve" | undefined {
    const raw = normalizeString(value);
    if (!raw) return undefined;
    if (raw === "off" || raw === "deny" || raw === "approve") {
        return raw;
    }
    return undefined;
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
        nonOwnerToolAuthMode: normalizeNonOwnerToolAuthMode(source.nonOwnerToolAuthMode),
        nonOwnerToolAuthTools: normalizeStringArray(source.nonOwnerToolAuthTools),
        toolAuthBypassWxids: normalizeStringArray(source.toolAuthBypassWxids),
        toolAuthBypassByTool: normalizeToolAuthBypassByTool(source.toolAuthBypassByTool),
        toolAuthBlockedSkills: normalizeStringArray(source.toolAuthBlockedSkills),
        toolAuthAllowInstalledSkills: normalizeBoolean(source.toolAuthAllowInstalledSkills),
        toolAuthDebugInstalledSkills: normalizeBoolean(source.toolAuthDebugInstalledSkills),
        ownerExecBypassApproval: normalizeBoolean(source.ownerExecBypassApproval),
        toolAuthNotifyBlocked: normalizeBoolean(source.toolAuthNotifyBlocked),
        toolAuthNotifyApprovalQueued: normalizeBoolean(source.toolAuthNotifyApprovalQueued),
        toolAuthNotifyApprovalResolved: normalizeBoolean(source.toolAuthNotifyApprovalResolved),
        toolAuthNotifyInGroup: normalizeBoolean(source.toolAuthNotifyInGroup),
        toolAuthNotifyInDirect: normalizeBoolean(source.toolAuthNotifyInDirect),
        toolAuthMessageBlocked: normalizeString(source.toolAuthMessageBlocked),
        toolAuthMessageQueued: normalizeString(source.toolAuthMessageQueued),
        toolAuthMessageAllowOnce: normalizeString(source.toolAuthMessageAllowOnce),
        toolAuthMessageAllowAlways: normalizeString(source.toolAuthMessageAllowAlways),
        toolAuthMessageDeny: normalizeString(source.toolAuthMessageDeny),
        toolAuthMessageTimeout: normalizeString(source.toolAuthMessageTimeout),
        toolAuthMessageCancelled: normalizeString(source.toolAuthMessageCancelled),
        redactWxidsInOutboundText: normalizeBoolean(source.redactWxidsInOutboundText),
        redactWxidsInLogs: normalizeBoolean(source.redactWxidsInLogs),
        redactExtraWxids: normalizeStringArray(source.redactExtraWxids),
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

    const wsHost = normalizeString(root.wsHost) || local.wsHost || "127.0.0.1";
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
    const nonOwnerToolAuthMode =
        normalizeNonOwnerToolAuthMode(root.nonOwnerToolAuthMode) ||
        local.nonOwnerToolAuthMode ||
        "off";
    const nonOwnerToolAuthTools =
        normalizeStringArray(root.nonOwnerToolAuthTools) ||
        local.nonOwnerToolAuthTools ||
        ["exec", "process"];
    const toolAuthBypassWxids =
        normalizeStringArray(root.toolAuthBypassWxids) ||
        local.toolAuthBypassWxids ||
        [];
    const toolAuthBypassByTool =
        normalizeToolAuthBypassByTool(root.toolAuthBypassByTool) ||
        local.toolAuthBypassByTool ||
        {};
    const toolAuthBlockedSkills =
        normalizeStringArray(root.toolAuthBlockedSkills) ||
        local.toolAuthBlockedSkills ||
        [];
    const toolAuthAllowInstalledSkills =
        normalizeBoolean(root.toolAuthAllowInstalledSkills) ??
        local.toolAuthAllowInstalledSkills ??
        false;
    const toolAuthDebugInstalledSkills =
        normalizeBoolean(root.toolAuthDebugInstalledSkills) ??
        local.toolAuthDebugInstalledSkills ??
        false;
    const ownerExecBypassApproval =
        normalizeBoolean(root.ownerExecBypassApproval) ??
        local.ownerExecBypassApproval ??
        false;
    const toolAuthNotifyBlocked =
        normalizeBoolean(root.toolAuthNotifyBlocked) ??
        local.toolAuthNotifyBlocked ??
        true;
    const toolAuthNotifyApprovalQueued =
        normalizeBoolean(root.toolAuthNotifyApprovalQueued) ??
        local.toolAuthNotifyApprovalQueued ??
        true;
    const toolAuthNotifyApprovalResolved =
        normalizeBoolean(root.toolAuthNotifyApprovalResolved) ??
        local.toolAuthNotifyApprovalResolved ??
        true;
    const toolAuthNotifyInGroup =
        normalizeBoolean(root.toolAuthNotifyInGroup) ??
        local.toolAuthNotifyInGroup ??
        true;
    const toolAuthNotifyInDirect =
        normalizeBoolean(root.toolAuthNotifyInDirect) ??
        local.toolAuthNotifyInDirect ??
        true;
    const toolAuthMessageBlocked =
        normalizeString(root.toolAuthMessageBlocked) ??
        local.toolAuthMessageBlocked;
    const toolAuthMessageQueued =
        normalizeString(root.toolAuthMessageQueued) ??
        local.toolAuthMessageQueued;
    const toolAuthMessageAllowOnce =
        normalizeString(root.toolAuthMessageAllowOnce) ??
        local.toolAuthMessageAllowOnce;
    const toolAuthMessageAllowAlways =
        normalizeString(root.toolAuthMessageAllowAlways) ??
        local.toolAuthMessageAllowAlways;
    const toolAuthMessageDeny =
        normalizeString(root.toolAuthMessageDeny) ??
        local.toolAuthMessageDeny;
    const toolAuthMessageTimeout =
        normalizeString(root.toolAuthMessageTimeout) ??
        local.toolAuthMessageTimeout;
    const toolAuthMessageCancelled =
        normalizeString(root.toolAuthMessageCancelled) ??
        local.toolAuthMessageCancelled;
    const redactWxidsInOutboundText =
        normalizeBoolean(root.redactWxidsInOutboundText) ??
        local.redactWxidsInOutboundText ??
        true;
    const redactWxidsInLogs =
        normalizeBoolean(root.redactWxidsInLogs) ??
        local.redactWxidsInLogs ??
        true;
    const redactExtraWxids =
        normalizeStringArray(root.redactExtraWxids) ||
        local.redactExtraWxids ||
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
        nonOwnerToolAuthMode,
        nonOwnerToolAuthTools,
        toolAuthBypassWxids,
        toolAuthBypassByTool,
        toolAuthBlockedSkills,
        toolAuthAllowInstalledSkills,
        toolAuthDebugInstalledSkills,
        ownerExecBypassApproval,
        toolAuthNotifyBlocked,
        toolAuthNotifyApprovalQueued,
        toolAuthNotifyApprovalResolved,
        toolAuthNotifyInGroup,
        toolAuthNotifyInDirect,
        toolAuthMessageBlocked,
        toolAuthMessageQueued,
        toolAuthMessageAllowOnce,
        toolAuthMessageAllowAlways,
        toolAuthMessageDeny,
        toolAuthMessageTimeout,
        toolAuthMessageCancelled,
        redactWxidsInOutboundText,
        redactWxidsInLogs,
        redactExtraWxids,
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
