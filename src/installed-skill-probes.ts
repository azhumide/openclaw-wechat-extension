import * as path from "node:path";
import {
    isWechatPathWithinRoots,
    normalizeWechatExecutableBase,
    resolveWechatCommandPathCandidate,
    splitWechatShellTokens,
    unquoteWechatShellToken,
} from "./installed-skill-shell.js";
import { resolveWechatSkillIdFromPath } from "./installed-skill-paths.js";
import type { WechatInstalledSkillMatchInfo } from "./installed-skill-types.js";

function buildWechatReadonlyProbeMatch(params: {
    segment: string;
    skillRoots: string[];
    path: string;
}): WechatInstalledSkillMatchInfo {
    return {
        matched: true,
        reason: "readonly-probe",
        skillId: resolveWechatSkillIdFromPath(params.path, params.skillRoots),
        segment: params.segment,
        path: params.path,
    };
}

function resolveWechatReadonlyProbeTargetPaths(params: {
    tokens: string[];
    startIndex: number;
    workdir?: string;
    skillRoots: string[];
    allowEmpty?: boolean;
}): string[] | null {
    const rawPathTokens = params.tokens.slice(params.startIndex).filter((token) => {
        const raw = unquoteWechatShellToken(token).trim();
        return Boolean(raw) && !raw.startsWith("-");
    });

    if (rawPathTokens.length === 0) {
        if (!params.allowEmpty || !params.workdir) {
            return null;
        }
        const resolvedWorkdir = path.resolve(params.workdir);
        return isWechatPathWithinRoots(resolvedWorkdir, params.skillRoots)
            ? [resolvedWorkdir]
            : null;
    }

    const resolvedTargets = rawPathTokens
        .map((token) => resolveWechatCommandPathCandidate(token, params.workdir))
        .filter((entry): entry is string => Boolean(entry));
    if (resolvedTargets.length !== rawPathTokens.length) {
        return null;
    }
    if (!resolvedTargets.every((entry) => isWechatPathWithinRoots(entry, params.skillRoots))) {
        return null;
    }
    return resolvedTargets;
}

function resolveWechatFindProbeSegment(params: {
    segment: string;
    tokens: string[];
    workdir?: string;
    skillRoots: string[];
}): WechatInstalledSkillMatchInfo {
    let index = 1;
    const pathTokens: string[] = [];

    while (index < params.tokens.length) {
        const raw = unquoteWechatShellToken(params.tokens[index]).trim();
        if (!raw || raw.startsWith("-") || raw === "!" || raw === "(" || raw === ")" || raw === "\\(" || raw === "\\)") {
            break;
        }
        pathTokens.push(params.tokens[index]);
        index += 1;
    }

    const resolvedTargets = resolveWechatReadonlyProbeTargetPaths({
        tokens: pathTokens,
        startIndex: 0,
        workdir: params.workdir,
        skillRoots: params.skillRoots,
        allowEmpty: true,
    });
    if (!resolvedTargets || resolvedTargets.length === 0) {
        return { matched: false };
    }

    while (index < params.tokens.length) {
        const raw = unquoteWechatShellToken(params.tokens[index]).trim();
        const lower = raw.toLowerCase();
        if (!raw) {
            index += 1;
            continue;
        }

        if (lower === "-maxdepth" || lower === "-mindepth") {
            const value = unquoteWechatShellToken(params.tokens[index + 1] || "").trim();
            if (!/^\d+$/.test(value)) {
                return { matched: false };
            }
            index += 2;
            continue;
        }
        if (lower === "-type") {
            const value = unquoteWechatShellToken(params.tokens[index + 1] || "").trim().toLowerCase();
            if (!/^[fdl]$/.test(value)) {
                return { matched: false };
            }
            index += 2;
            continue;
        }
        if (
            lower === "-name" ||
            lower === "-iname" ||
            lower === "-path" ||
            lower === "-ipath"
        ) {
            const value = unquoteWechatShellToken(params.tokens[index + 1] || "").trim();
            if (!value) {
                return { matched: false };
            }
            index += 2;
            continue;
        }
        if (
            lower === "-print" ||
            lower === "-a" ||
            lower === "-o" ||
            lower === "-not" ||
            raw === "!" ||
            raw === "(" ||
            raw === ")" ||
            raw === "\\(" ||
            raw === "\\)"
        ) {
            index += 1;
            continue;
        }

        return { matched: false };
    }

    return buildWechatReadonlyProbeMatch({
        segment: params.segment,
        skillRoots: params.skillRoots,
        path: resolvedTargets[0],
    });
}

export function resolveWechatSkillReadonlyProbeSegment(params: {
    segment: string;
    workdir?: string;
    skillRoots: string[];
}): WechatInstalledSkillMatchInfo {
    const tokens = splitWechatShellTokens(params.segment);
    if (tokens.length === 0) {
        return { matched: false };
    }
    const execBase = normalizeWechatExecutableBase(tokens[0]);

    if (execBase === "pwd") {
        if (tokens.length !== 1 || !params.workdir) {
            return { matched: false };
        }
        const resolvedWorkdir = path.resolve(params.workdir);
        if (!isWechatPathWithinRoots(resolvedWorkdir, params.skillRoots)) {
            return { matched: false };
        }
        return buildWechatReadonlyProbeMatch({
            segment: params.segment,
            skillRoots: params.skillRoots,
            path: resolvedWorkdir,
        });
    }

    if (execBase === "find") {
        return resolveWechatFindProbeSegment({
            segment: params.segment,
            tokens,
            workdir: params.workdir,
            skillRoots: params.skillRoots,
        });
    }

    if (execBase === "test") {
        if (tokens.length !== 3) {
            return { matched: false };
        }
        const flag = unquoteWechatShellToken(tokens[1]).trim().toLowerCase();
        if (!new Set(["-e", "-f", "-d", "-l", "-r", "-w", "-x", "-s"]).has(flag)) {
            return { matched: false };
        }
        const resolvedTargets = resolveWechatReadonlyProbeTargetPaths({
            tokens: [tokens[2]],
            startIndex: 0,
            workdir: params.workdir,
            skillRoots: params.skillRoots,
        });
        if (!resolvedTargets || resolvedTargets.length !== 1) {
            return { matched: false };
        }
        return buildWechatReadonlyProbeMatch({
            segment: params.segment,
            skillRoots: params.skillRoots,
            path: resolvedTargets[0],
        });
    }

    if (execBase === "ls" || execBase === "stat" || execBase === "readlink") {
        const resolvedTargets = resolveWechatReadonlyProbeTargetPaths({
            tokens,
            startIndex: 1,
            workdir: params.workdir,
            skillRoots: params.skillRoots,
            allowEmpty: true,
        });
        if (!resolvedTargets || resolvedTargets.length === 0) {
            return { matched: false };
        }
        return buildWechatReadonlyProbeMatch({
            segment: params.segment,
            skillRoots: params.skillRoots,
            path: resolvedTargets[0],
        });
    }

    return { matched: false };
}
