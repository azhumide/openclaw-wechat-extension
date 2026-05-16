import * as path from "node:path";
import type { resolveWechatExtensionConfig } from "./config.js";
import {
    resolveWechatInstalledSkillsSnapshot,
    summarizeWechatSkillRootsForLog,
} from "./installed-skill-roots.js";
import {
    isWechatPathWithinRoots,
    normalizeWechatExecutableBase,
    resolveWechatCommandPathCandidate,
    splitWechatShellSegments,
    splitWechatShellTokens,
    unquoteWechatShellToken,
    unwrapWechatInstalledSkillCommand,
    WECHAT_SKILL_SCRIPT_EXTENSIONS,
} from "./installed-skill-shell.js";
import { resolveWechatSkillIdFromPath } from "./installed-skill-paths.js";
import { resolveWechatSkillReadonlyProbeSegment } from "./installed-skill-probes.js";
import { summarizeWechatTextForLog } from "./text.js";
import type { WechatInstalledSkillMatchInfo } from "./installed-skill-types.js";

export {
    resolveWechatSafeReadonlyExecCommandMatch,
    resolveWechatSafeReadonlyExecRoots,
} from "./installed-skill-readonly.js";
export type { WechatInstalledSkillMatchInfo } from "./installed-skill-types.js";

const WECHAT_SKILL_LOCAL_EXECUTABLES = new Set([
    "python",
    "python3",
    "python3.10",
    "python3.11",
    "python3.12",
    "node",
    "pip",
    "pip3",
    "uv",
    "npm",
    "pnpm",
    "yarn",
]);
const WECHAT_SKILL_MARKER_VALUES = new Set([
    "---CMD---",
    "\\n---CMD---\\n",
    "\n---CMD---\n",
]);

function resolveWechatSkillPreludeReadSegment(segment: string, workdir: string | undefined, skillRoots: string[]): {
    matched: boolean;
    skillId?: string;
    path?: string;
} {
    const tokens = splitWechatShellTokens(segment);
    if (tokens.length !== 2 || normalizeWechatExecutableBase(tokens[0]) !== "cat") {
        return { matched: false };
    }
    const candidatePath = resolveWechatCommandPathCandidate(tokens[1], workdir);
    if (!candidatePath ||
        !candidatePath.toLowerCase().endsWith(`${path.sep}SKILL.md`.toLowerCase()) ||
        !isWechatPathWithinRoots(candidatePath, skillRoots)) {
        return { matched: false };
    }
    return {
        matched: true,
        skillId: resolveWechatSkillIdFromPath(candidatePath, skillRoots),
        path: candidatePath,
    };
}

function isWechatSkillPreludeMarkerSegment(segment: string): boolean {
    const tokens = splitWechatShellTokens(segment);
    return tokens.length === 2 &&
        normalizeWechatExecutableBase(tokens[0]) === "printf" &&
        WECHAT_SKILL_MARKER_VALUES.has(unquoteWechatShellToken(tokens[1]));
}

function resolveWechatSkillCdSegment(segment: string, workdir: string | undefined, skillRoots: string[]): string | null {
    const tokens = splitWechatShellTokens(segment);
    if (tokens.length !== 2 || normalizeWechatExecutableBase(tokens[0]) !== "cd") {
        return null;
    }
    const candidatePath = resolveWechatCommandPathCandidate(tokens[1], workdir);
    if (!candidatePath || !isWechatPathWithinRoots(candidatePath, skillRoots)) {
        return null;
    }
    return candidatePath;
}

function isWechatSkillSourceSegment(segment: string, workdir: string | undefined, skillRoots: string[]): boolean {
    const tokens = splitWechatShellTokens(segment);
    if (tokens.length !== 2) {
        return false;
    }
    const commandToken = normalizeWechatExecutableBase(tokens[0]);
    if (commandToken !== "source" && commandToken !== ".") {
        return false;
    }
    const candidatePath = resolveWechatCommandPathCandidate(tokens[1], workdir);
    return Boolean(candidatePath && isWechatPathWithinRoots(candidatePath, skillRoots));
}

function resolveWechatSkillExecSegment(params: {
    segment: string;
    workdir?: string;
    skillRoots: string[];
    skillIds: Set<string>;
}): WechatInstalledSkillMatchInfo {
    const tokens = splitWechatShellTokens(params.segment);
    if (tokens.length === 0) {
        return { matched: false };
    }

    const execBase = normalizeWechatExecutableBase(tokens[0]);
    if (execBase.endsWith("-wrapper") && params.skillIds.has(execBase.slice(0, -"-wrapper".length))) {
        return {
            matched: true,
            reason: "wrapper",
            skillId: execBase.slice(0, -"-wrapper".length),
            segment: params.segment,
        };
    }

    const resolvedExecPath = resolveWechatCommandPathCandidate(tokens[0], params.workdir);
    if (resolvedExecPath && isWechatPathWithinRoots(resolvedExecPath, params.skillRoots)) {
        return {
            matched: true,
            reason: "script-path",
            skillId: resolveWechatSkillIdFromPath(resolvedExecPath, params.skillRoots),
            segment: params.segment,
            path: resolvedExecPath,
        };
    }

    const readonlyProbeMatch = resolveWechatSkillReadonlyProbeSegment({
        segment: params.segment,
        workdir: params.workdir,
        skillRoots: params.skillRoots,
    });
    if (readonlyProbeMatch.matched) {
        return readonlyProbeMatch;
    }

    const resolvedPathCandidates = tokens
        .map((token) => resolveWechatCommandPathCandidate(token, params.workdir))
        .filter((entry): entry is string => Boolean(entry));
    const skillLocalPaths = resolvedPathCandidates.filter((entry) => isWechatPathWithinRoots(entry, params.skillRoots));
    const hasSkillScriptPath = skillLocalPaths.some((entry) =>
        WECHAT_SKILL_SCRIPT_EXTENSIONS.has(path.extname(entry).toLowerCase()),
    );
    const hasInlineEvalFlag = tokens.some((token) => {
        const raw = unquoteWechatShellToken(token).trim().toLowerCase();
        return raw === "-c" || raw === "-e" || raw === "--eval" || raw.startsWith("--eval=");
    });

    if (hasInlineEvalFlag) {
        for (const skillId of params.skillIds) {
            if (params.segment.includes(skillId)) {
                return {
                    matched: true,
                    reason: "inline-eval-fallback",
                    skillId: skillId,
                    segment: params.segment,
                };
            }
        }
        return { matched: false };
    }

    if (hasSkillScriptPath) {
        const matchedPath = skillLocalPaths.find((entry) =>
            WECHAT_SKILL_SCRIPT_EXTENSIONS.has(path.extname(entry).toLowerCase()),
        );
        return {
            matched: true,
            reason: "script-path",
            skillId: matchedPath ? resolveWechatSkillIdFromPath(matchedPath, params.skillRoots) : undefined,
            segment: params.segment,
            path: matchedPath,
        };
    }

    if (params.workdir && isWechatPathWithinRoots(path.resolve(params.workdir), params.skillRoots)) {
        if (WECHAT_SKILL_LOCAL_EXECUTABLES.has(execBase)) {
            return {
                matched: true,
                reason: "skill-cwd-cli",
                skillId: resolveWechatSkillIdFromPath(path.resolve(params.workdir), params.skillRoots),
                segment: params.segment,
                path: path.resolve(params.workdir),
            };
        }
    }

    return { matched: false };
}

export function resolveWechatInstalledSkillCommandMatch(command: string, workdir: string | undefined, config: ReturnType<typeof resolveWechatExtensionConfig>): WechatInstalledSkillMatchInfo {
    const trimmed = command.trim();
    if (!trimmed) {
        return { matched: false };
    }

    const { roots: skillRoots, skillIds } = resolveWechatInstalledSkillsSnapshot(config);
    if (skillRoots.length === 0 || skillIds.size === 0) {
        return { matched: false };
    }

    const unwrappedCommand = unwrapWechatInstalledSkillCommand(trimmed, workdir);
    const segments = splitWechatShellSegments(unwrappedCommand.command);
    if (segments.length === 0) {
        return { matched: false };
    }

    let currentWorkdir = unwrappedCommand.workdir?.trim() || process.cwd();
    let matchedSkillExec: WechatInstalledSkillMatchInfo | null = null;
    let preludeSkillId: string | undefined;

    for (const segment of segments) {
        const preludeRead = resolveWechatSkillPreludeReadSegment(segment, currentWorkdir, skillRoots);
        if (preludeRead.matched) {
            preludeSkillId = preludeRead.skillId || preludeSkillId;
            continue;
        }
        if (isWechatSkillPreludeMarkerSegment(segment)) {
            continue;
        }

        const cdTarget = resolveWechatSkillCdSegment(segment, currentWorkdir, skillRoots);
        if (cdTarget) {
            currentWorkdir = cdTarget;
            continue;
        }

        if (isWechatSkillSourceSegment(segment, currentWorkdir, skillRoots)) {
            continue;
        }

        const execMatch = resolveWechatSkillExecSegment({
            segment,
            workdir: currentWorkdir,
            skillRoots,
            skillIds,
        });
        if (execMatch.matched) {
            matchedSkillExec = {
                ...execMatch,
                skillId: execMatch.skillId || preludeSkillId,
                wrappers: unwrappedCommand.wrappers,
            };
            continue;
        }

        return { matched: false };
    }

    return matchedSkillExec || { matched: false };
}

export function summarizeWechatInstalledSkillMatch(match: WechatInstalledSkillMatchInfo): string {
    if (!match.matched) {
        return "";
    }
    const parts: string[] = [];
    if (match.skillId) {
        parts.push(`skill=${match.skillId}`);
    }
    if (match.reason) {
        parts.push(`reason=${match.reason}`);
    }
    if (match.segment) {
        parts.push(`segment="${summarizeWechatTextForLog(match.segment, 120)}"`);
    }
    if (match.path) {
        parts.push(`path="${summarizeWechatTextForLog(match.path, 160)}"`);
    }
    if (match.wrappers && match.wrappers.length > 0) {
        parts.push(`via=${match.wrappers.join(">")}`);
    }
    return parts.join(" ");
}

export function buildWechatInstalledSkillDebugSummary(command: string, workdir: string | undefined, config: ReturnType<typeof resolveWechatExtensionConfig>): string {
    const trimmed = command.trim();
    if (!trimmed) {
        return "reason=empty-command";
    }

    const { roots: skillRoots, skillIds } = resolveWechatInstalledSkillsSnapshot(config);
    if (skillRoots.length === 0 || skillIds.size === 0) {
        return `reason=no-skill-roots ${summarizeWechatSkillRootsForLog(skillRoots)} skills=${skillIds.size}`;
    }

    const unwrapped = unwrapWechatInstalledSkillCommand(trimmed, workdir);
    const segments = splitWechatShellSegments(unwrapped.command);
    const viaSummary = unwrapped.wrappers.length > 0 ? ` via=${unwrapped.wrappers.join(">")}` : "";
    const workdirSummary = unwrapped.workdir
        ? ` workdir="${summarizeWechatTextForLog(unwrapped.workdir, 100)}"`
        : "";

    if (segments.length === 0) {
        return `reason=no-segments ${summarizeWechatSkillRootsForLog(skillRoots)}${viaSummary}${workdirSummary}`;
    }

    let currentWorkdir = unwrapped.workdir?.trim() || process.cwd();
    let sawSkillExec = false;

    for (const segment of segments) {
        const preludeRead = resolveWechatSkillPreludeReadSegment(segment, currentWorkdir, skillRoots);
        if (preludeRead.matched) {
            continue;
        }
        if (isWechatSkillPreludeMarkerSegment(segment)) {
            continue;
        }

        const cdTarget = resolveWechatSkillCdSegment(segment, currentWorkdir, skillRoots);
        if (cdTarget) {
            currentWorkdir = cdTarget;
            continue;
        }

        if (isWechatSkillSourceSegment(segment, currentWorkdir, skillRoots)) {
            continue;
        }

        const execMatch = resolveWechatSkillExecSegment({
            segment,
            workdir: currentWorkdir,
            skillRoots,
            skillIds,
        });
        if (execMatch.matched) {
            sawSkillExec = true;
            continue;
        }

        return `reason=segment-not-trusted segment="${summarizeWechatTextForLog(segment, 140)}"${viaSummary}${workdirSummary} ${summarizeWechatSkillRootsForLog(skillRoots)}`;
    }

    if (!sawSkillExec) {
        return `reason=no-skill-exec segments=${segments.length}${viaSummary}${workdirSummary} ${summarizeWechatSkillRootsForLog(skillRoots)}`;
    }

    return `reason=matched-without-record ${summarizeWechatSkillRootsForLog(skillRoots)}${viaSummary}${workdirSummary}`;
}
