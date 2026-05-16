import * as fs from "node:fs";
import * as path from "node:path";
import type { resolveWechatExtensionConfig } from "./config.js";
import { summarizeWechatTextForLog } from "./text.js";

let wechatInstalledSkillCache:
    | { key: string; expiresAt: number; roots: string[]; skillIds: Set<string> }
    | null = null;

function getWechatSkillRootCandidates(config: ReturnType<typeof resolveWechatExtensionConfig>): string[] {
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    const workspaceBase = config.workspaceBase ? path.resolve(config.workspaceBase) : "";
    const workspaceParent = workspaceBase ? path.dirname(workspaceBase) : "";
    const extensionParents = [
        path.join(process.cwd(), ".openclaw", "extensions"),
        path.join(process.cwd(), "extensions"),
        path.join(process.cwd(), "openclaw", "extensions"),
        workspaceBase ? path.join(workspaceBase, "extensions") : "",
        workspaceParent ? path.join(workspaceParent, "extensions") : "",
    ]
        .map((entry) => entry && path.resolve(entry))
        .filter(Boolean);
    const candidates = [
        path.join(process.cwd(), ".openclaw", "skills"),
        path.join(process.cwd(), "skills"),
        path.join(process.cwd(), "openclaw", "skills"),
        path.join(process.cwd(), ".agents", "skills"),
        homeDir ? path.join(homeDir, ".openclaw", "skills") : "",
        homeDir ? path.join(homeDir, ".agents", "skills") : "",
        workspaceBase ? path.join(workspaceBase, "skills") : "",
        workspaceBase ? path.join(workspaceBase, ".agents", "skills") : "",
        workspaceParent ? path.join(workspaceParent, "skills") : "",
        workspaceParent ? path.join(workspaceParent, ".agents", "skills") : "",
        ...extensionParents.flatMap((parentDir) => {
            try {
                return fs.readdirSync(parentDir, { withFileTypes: true })
                    .filter((entry) => entry.isDirectory())
                    .map((entry) => path.join(parentDir, entry.name, "skills"));
            } catch {
                return [];
            }
        }),
    ]
        .map((entry) => entry && path.resolve(entry))
        .filter(Boolean);

    return [...new Set(candidates)];
}

export function resolveWechatInstalledSkillsSnapshot(config: ReturnType<typeof resolveWechatExtensionConfig>): {
    roots: string[];
    skillIds: Set<string>;
} {
    const roots = getWechatSkillRootCandidates(config).filter((root) => fs.existsSync(root));
    const cacheKey = roots.join("|");
    const now = Date.now();
    if (wechatInstalledSkillCache && wechatInstalledSkillCache.key === cacheKey && wechatInstalledSkillCache.expiresAt > now) {
        return {
            roots: wechatInstalledSkillCache.roots,
            skillIds: new Set(wechatInstalledSkillCache.skillIds),
        };
    }

    const skillIds = new Set<string>();
    for (const root of roots) {
        try {
            for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
                if (!entry.isDirectory()) {
                    continue;
                }
                const skillMdPath = path.join(root, entry.name, "SKILL.md");
                if (fs.existsSync(skillMdPath)) {
                    skillIds.add(entry.name.trim().toLowerCase());
                }
            }
        } catch {
            continue;
        }
    }

    wechatInstalledSkillCache = {
        key: cacheKey,
        expiresAt: now + 30_000,
        roots,
        skillIds,
    };
    return {
        roots,
        skillIds,
    };
}

export function summarizeWechatSkillRootsForLog(roots: string[]): string {
    if (roots.length === 0) {
        return "roots=0";
    }
    const preview = roots
        .slice(0, 3)
        .map((entry) => summarizeWechatTextForLog(entry, 80))
        .join(",");
    return roots.length > 3
        ? `roots=${roots.length} sample="${preview},..."`
        : `roots=${roots.length} sample="${preview}"`;
}
