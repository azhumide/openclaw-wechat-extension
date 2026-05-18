import * as path from "node:path";
import type { resolveWechatExtensionConfig } from "./config.js";
import {
    isWechatLocalMediaReference,
    isWechatSafeLocalAttachmentPath,
} from "./media.js";
import {
    isWechatPathWithinRoots,
    normalizeWechatExecutableBase,
    splitWechatShellSegments,
    splitWechatShellTokens,
    unquoteWechatShellToken,
    WECHAT_SAFE_READONLY_EXEC_SHELL_META_RE,
} from "./installed-skill-shell.js";

export function normalizeGuardedToolNameList(value: string[] | undefined): Set<string> {
    return new Set(
        (value || [])
            .map((entry) => entry.trim().toLowerCase())
            .filter(Boolean),
    );
}

export function normalizeWechatIdAllowList(value: string[] | undefined): Set<string> {
    return new Set(
        (value || [])
            .map((entry) => entry.trim().toLowerCase())
            .filter(Boolean),
    );
}

export function normalizeWechatSkillIdList(value: string[] | undefined): Set<string> {
    return new Set(
        (value || [])
            .map((entry) => entry.trim().toLowerCase())
            .filter(Boolean),
    );
}

function buildWechatBlockedSkillIntentAliases(skillId: string): string[] {
    const normalized = skillId.trim().toLowerCase();
    if (!normalized) {
        return [];
    }

    const aliases = new Set<string>();
    const base = normalized.replace(/-skill$/i, "");
    const tokens = base.split(/[-_]+/).map((entry) => entry.trim()).filter(Boolean);

    aliases.add(normalized);
    aliases.add(base);
    aliases.add(base.replace(/[-_]+/g, ""));
    aliases.add(base.replace(/[-_]+/g, " "));

    for (const token of tokens) {
        if (token === "skill" || token === "helper" || token === "tools" || token === "tool" || token === "agent") {
            continue;
        }
        if (token.length >= 3 || /^\d{3,}$/.test(token)) {
            aliases.add(token);
        }
    }

    return [...aliases].filter(Boolean);
}

export function matchWechatBlockedSkillIntent(text: string | undefined, blockedSkills: Set<string>): {
    matched: boolean;
    skillId?: string;
    alias?: string;
} {
    const normalizedText = (text || "").trim().toLowerCase();
    if (!normalizedText || blockedSkills.size === 0) {
        return { matched: false };
    }

    const compactText = normalizedText.replace(/\s+/g, "");
    const hasSkillishContext = /插件|skill|脚本|账号|状态|进度|补跑|运行|查询|查看|看看|多少/u.test(normalizedText);

    for (const skillId of blockedSkills) {
        const aliases = buildWechatBlockedSkillIntentAliases(skillId);
        for (const alias of aliases) {
            const trimmedAlias = alias.trim();
            if (!trimmedAlias) {
                continue;
            }

            const aliasCompact = trimmedAlias.replace(/\s+/g, "");
            const containsAlias = normalizedText.includes(trimmedAlias) || compactText.includes(aliasCompact);
            if (!containsAlias) {
                continue;
            }

            const isNumericAlias = /^\d{3,}$/.test(trimmedAlias);
            if (isNumericAlias && !hasSkillishContext) {
                continue;
            }

            return {
                matched: true,
                skillId,
                alias: trimmedAlias,
            };
        }
    }

    return { matched: false };
}

export function resolveWechatToolBypassMatch(
    allowList: Set<string>,
    authContext: {
        senderId?: string;
        from?: string;
    },
): { matched: boolean; kind?: "senderId" | "from"; value?: string } {
    const senderId = authContext.senderId?.trim().toLowerCase();
    if (senderId && allowList.has(senderId)) {
        return {
            matched: true,
            kind: "senderId",
            value: authContext.senderId,
        };
    }

    const from = authContext.from?.trim().toLowerCase();
    if (from && allowList.has(from)) {
        return {
            matched: true,
            kind: "from",
            value: authContext.from,
        };
    }

    return { matched: false };
}

export function getWechatToolSpecificAllowList(
    config: ReturnType<typeof resolveWechatExtensionConfig>,
    toolName: string,
): Set<string> {
    const entries = config.toolAuthBypassByTool?.[toolName] || [];
    return normalizeWechatIdAllowList(entries);
}

export function resolveWechatSystemSafePathBypass(params: {
    toolName: string;
    rawPath?: unknown;
}): {
    matched: boolean;
    targetPath?: string;
} {
    if (params.toolName !== "write" && params.toolName !== "read") {
        return { matched: false };
    }

    const targetPath = String(params.rawPath || "").trim().replace(/\\/g, "/");
    const systemSafePrefixes = ["memory/", "memory"];
    const systemSafeFiles = [
        "MEMORY.md",
        "DREAMS.md",
        "AGENTS.md",
        "SOUL.md",
        "TOOLS.md",
        "BOOT.md",
    ];
    const isSystemSafe =
        systemSafePrefixes.some((prefix) =>
            targetPath === prefix ||
            targetPath.startsWith(prefix + (prefix.endsWith("/") ? "" : "/")),
        ) ||
        systemSafeFiles.some((fileName) =>
            targetPath === fileName ||
            targetPath.endsWith("/" + fileName),
        );

    return {
        matched: isSystemSafe,
        targetPath,
    };
}

function hasWechatUnsafeShellComposition(command: string): boolean {
    let inSingle = false;
    let inDouble = false;
    let escaped = false;

    for (let index = 0; index < command.length; index += 1) {
        const ch = command[index];

        if (escaped) {
            escaped = false;
            continue;
        }
        if (!inSingle && ch === "\\") {
            escaped = true;
            continue;
        }
        if (ch === "'" && !inDouble) {
            inSingle = !inSingle;
            continue;
        }
        if (ch === "\"" && !inSingle) {
            inDouble = !inDouble;
            continue;
        }

        if (ch === "`" || (!inSingle && ch === "$")) {
            return true;
        }
        if (!inSingle && !inDouble && /[;&|<>]/.test(ch)) {
            return true;
        }
    }

    return false;
}

function readWechatSafeDownloadOutputPath(params: {
    execBase: string;
    tokens: string[];
    workspaceBase: string;
}): string | null {
    let outputPath = "";
    let remoteUrlCount = 0;

    const readNextValue = (index: number) => {
        const next = params.tokens[index + 1];
        return next ? unquoteWechatShellToken(next).trim() : "";
    };
    const acceptOutputPath = (candidate: string) => {
        const resolvedPath = path.resolve(candidate);
        if (!isWechatPathWithinRoots(resolvedPath, [params.workspaceBase])) {
            return false;
        }
        outputPath = resolvedPath;
        return true;
    };

    for (let index = 1; index < params.tokens.length; index += 1) {
        const arg = unquoteWechatShellToken(params.tokens[index]).trim();
        if (!arg) {
            return null;
        }
        if (/^https?:\/\//i.test(arg)) {
            remoteUrlCount += 1;
            continue;
        }

        if (params.execBase === "wget") {
            if (arg === "-O" || arg === "--output-document") {
                const nextValue = readNextValue(index);
                if (!nextValue || !acceptOutputPath(nextValue)) {
                    return null;
                }
                index += 1;
                continue;
            }
            if (arg.startsWith("--output-document=")) {
                if (!acceptOutputPath(arg.slice("--output-document=".length))) {
                    return null;
                }
                continue;
            }
            if (
                arg === "-q" ||
                arg === "--quiet" ||
                arg === "-nv" ||
                arg === "--no-verbose" ||
                /^--(?:timeout|tries)=\d{1,4}$/.test(arg)
            ) {
                continue;
            }
            return null;
        }

        if (params.execBase === "curl") {
            if (arg === "-o" || arg === "--output") {
                const nextValue = readNextValue(index);
                if (!nextValue || !acceptOutputPath(nextValue)) {
                    return null;
                }
                index += 1;
                continue;
            }
            if (arg.startsWith("--output=")) {
                if (!acceptOutputPath(arg.slice("--output=".length))) {
                    return null;
                }
                continue;
            }
            if (
                arg === "-L" ||
                arg === "--location" ||
                arg === "-f" ||
                arg === "--fail" ||
                arg === "-s" ||
                arg === "-S" ||
                arg === "-sS" ||
                arg === "--silent" ||
                arg === "--show-error" ||
                arg === "--compressed" ||
                /^--(?:connect-timeout|max-time|retry)=\d{1,4}$/.test(arg)
            ) {
                continue;
            }
            if (arg === "--connect-timeout" || arg === "--max-time" || arg === "--retry") {
                const nextValue = readNextValue(index);
                if (!/^\d{1,4}$/.test(nextValue)) {
                    return null;
                }
                index += 1;
                continue;
            }
            return null;
        }
    }

    return outputPath && remoteUrlCount === 1 ? outputPath : null;
}

function isWechatSafeDownloadSegment(segment: string, workspaceBase: string): boolean {
    if (hasWechatUnsafeShellComposition(segment)) {
        return false;
    }
    const tokens = splitWechatShellTokens(segment);
    if (tokens.length === 0) {
        return false;
    }
    const execBase = normalizeWechatExecutableBase(tokens[0]);
    if (execBase !== "curl" && execBase !== "wget") {
        return false;
    }
    const outputPath = readWechatSafeDownloadOutputPath({
        execBase,
        tokens,
        workspaceBase,
    });
    return Boolean(outputPath);
}

export function resolveWechatSafeDownloadExecBypass(params: {
    toolName: string;
    command?: string;
    workspaceBase?: string;
}): {
    matched: boolean;
    segmentCount?: number;
    firstSegment?: string;
} {
    if (params.toolName !== "exec" || !params.command) {
        return { matched: false };
    }

    const downloadSegments = params.command
        .split(/\n/)
        .map((segment) => segment.trim())
        .filter(Boolean);
    const workspaceBase = path.resolve(params.workspaceBase || "/home/rs/.openclaw/workspace");
    const allSafeDownloads =
        downloadSegments.length > 0 &&
        downloadSegments.every((segment) => splitWechatShellSegments(segment).length === 1) &&
        downloadSegments.every((segment) => isWechatSafeDownloadSegment(segment, workspaceBase));

    return {
        matched: allSafeDownloads,
        segmentCount: downloadSegments.length,
        firstSegment: downloadSegments[0],
    };
}

function findWechatMcporterExecutableTokenIndex(tokens: string[]): number {
    if (tokens.length === 0) {
        return -1;
    }

    const isMcporterToken = (token: string) => {
        const executable = normalizeWechatExecutableBase(token);
        const raw = unquoteWechatShellToken(token).trim().toLowerCase();
        return executable === "mcporter" || /^mcporter@[^/\\\s]+$/.test(raw);
    };

    const execBase = normalizeWechatExecutableBase(tokens[0]);
    if (isMcporterToken(tokens[0])) {
        return 0;
    }
    if (execBase !== "npx") {
        return -1;
    }

    for (let index = 1; index < tokens.length; index += 1) {
        const token = unquoteWechatShellToken(tokens[index]).trim();
        if (!token) {
            continue;
        }
        if (token === "--") {
            continue;
        }
        if (token === "-y" || token === "--yes" || token === "--no-install") {
            continue;
        }
        if (token === "-p" || token === "--package" || token === "--registry" || token === "--cache") {
            index += 1;
            continue;
        }
        if (
            token.startsWith("--package=") ||
            token.startsWith("--registry=") ||
            token.startsWith("--cache=")
        ) {
            continue;
        }
        return isMcporterToken(token) ? index : -1;
    }

    return -1;
}

export function resolveWechatMcporterExecBypass(params: {
    toolName: string;
    command?: string;
    allowMcporterExec?: boolean;
}): {
    matched: boolean;
    normalized?: string;
} {
    if (params.toolName !== "exec" || !params.allowMcporterExec || !params.command) {
        return { matched: false };
    }

    const normalized = params.command.trim();
    if (!normalized || /[\r\n]/.test(normalized)) {
        return { matched: false };
    }
    if (splitWechatShellSegments(normalized).length !== 1) {
        return { matched: false };
    }
    if (WECHAT_SAFE_READONLY_EXEC_SHELL_META_RE.test(normalized)) {
        return { matched: false };
    }

    const tokens = splitWechatShellTokens(normalized);
    const mcporterIndex = findWechatMcporterExecutableTokenIndex(tokens);
    if (mcporterIndex < 0) {
        return { matched: false };
    }
    if (tokens.slice(mcporterIndex + 1).some((token) => {
        const arg = unquoteWechatShellToken(token).trim();
        return !arg || WECHAT_SAFE_READONLY_EXEC_SHELL_META_RE.test(arg);
    })) {
        return { matched: false };
    }

    return {
        matched: true,
        normalized,
    };
}

export function shouldBlockWechatLocalAttachmentDelivery(params: {
    mediaUrl: string;
    authContext: {
        senderId?: string;
        from?: string;
        isMaster?: boolean;
    };
    config: ReturnType<typeof resolveWechatExtensionConfig>;
}): {
    blocked: boolean;
    absolutePath?: string;
    reason?: string;
} {
    if (!isWechatLocalMediaReference(params.mediaUrl)) {
        return { blocked: false };
    }

    const absolutePath = path.resolve(params.mediaUrl.trim());
    if (params.authContext.isMaster) {
        return { blocked: false, absolutePath };
    }

    const bypassMatch = resolveWechatToolBypassMatch(
        normalizeWechatIdAllowList(params.config.toolAuthBypassWxids),
        params.authContext,
    );
    if (bypassMatch.matched) {
        return { blocked: false, absolutePath };
    }

    if (isWechatSafeLocalAttachmentPath(absolutePath)) {
        return { blocked: false, absolutePath };
    }

    return {
        blocked: true,
        absolutePath,
        reason: "non-owner-local-file",
    };
}
