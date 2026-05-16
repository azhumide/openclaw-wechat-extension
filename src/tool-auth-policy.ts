import * as path from "node:path";
import type { resolveWechatExtensionConfig } from "./config.js";
import {
    isWechatLocalMediaReference,
    isWechatSafeLocalAttachmentPath,
} from "./media.js";

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
    const workspaceBase = params.workspaceBase || "/home/rs/.openclaw/workspace";
    const safeDownloadPattern = /^(?:curl\s+-[oO]|curl\s+.*-[oO]\s|wget\s+-O\s|wget\s+.*-O\s)/;
    const allSafeDownloads = downloadSegments.length > 0 && downloadSegments.every((segment) => {
        if (!safeDownloadPattern.test(segment)) {
            return false;
        }
        const outputMatch = segment.match(/-[oO]\s+["']?([^\s"']+)/);
        return Boolean(outputMatch && outputMatch[1].startsWith(workspaceBase));
    });

    return {
        matched: allSafeDownloads,
        segmentCount: downloadSegments.length,
        firstSegment: downloadSegments[0],
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
