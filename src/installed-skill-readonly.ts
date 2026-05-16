import * as path from "node:path";
import type { resolveWechatExtensionConfig } from "./config.js";
import {
    isWechatPathWithinRoots,
    normalizeWechatExecutableBase,
    resolveWechatCommandPathCandidate,
    splitWechatShellSegments,
    splitWechatShellTokens,
    unquoteWechatShellToken,
    unwrapWechatInstalledSkillCommand,
    WECHAT_SAFE_READONLY_EXEC_SHELL_META_RE,
} from "./installed-skill-shell.js";

function isWechatSafeDateArg(arg: string): boolean {
    if (arg === "-u" || arg === "--utc" || arg === "--universal") {
        return true;
    }
    if (arg === "-I" || /^-I(?:date|hours|minutes|seconds|ns)?$/.test(arg)) {
        return true;
    }
    if (/^--iso-8601(?:=(?:date|hours|minutes|seconds|ns))?$/.test(arg)) {
        return true;
    }
    if (/^--rfc-3339=(?:date|seconds|ns)$/.test(arg)) {
        return true;
    }
    if (arg.startsWith("+")) {
        return /^\+[A-Za-z0-9_:%.,@+\-/ ]{1,120}$/.test(arg);
    }
    return false;
}

export function resolveWechatSafeReadonlyExecRoots(config: ReturnType<typeof resolveWechatExtensionConfig>): string[] {
    const roots = new Set<string>();
    const pushRoot = (candidate?: string) => {
        const normalized = String(candidate || "").trim();
        if (normalized) {
            roots.add(path.resolve(normalized));
        }
    };

    pushRoot(config.workspaceBase);
    if (config.workspaceBase) {
        pushRoot(path.join(config.workspaceBase, "downloads"));
    }
    pushRoot(config.tmpDir);
    for (const candidate of config.mediaSearchPaths || []) {
        pushRoot(candidate);
    }
    return [...roots];
}

function isWechatSafeReadonlyPathProbe(params: {
    execBase: string;
    args: string[];
    workdir?: string;
    safePathRoots?: string[];
}): boolean {
    const safePathRoots = (params.safePathRoots || []).map((root) => path.resolve(root));
    if (safePathRoots.length === 0) {
        return false;
    }

    const allowedFlagsByCommand: Record<string, RegExp> = {
        ls: /^(?:-[A-Za-z0-9]+|--(?:all|almost-all|directory|dereference|human-readable|long|color=never))$/,
        stat: /^(?:-[A-Za-z]+|--(?:dereference|file-system|terse))$/,
        readlink: /^(?:-[A-Za-z]+|--(?:canonicalize|canonicalize-existing|canonicalize-missing|no-newline|verbose|quiet|silent))$/,
    };
    const allowedFlag = allowedFlagsByCommand[params.execBase];
    if (!allowedFlag) {
        return false;
    }

    let pathArgCount = 0;
    for (const arg of params.args) {
        if (arg.startsWith("-")) {
            if (!allowedFlag.test(arg)) {
                return false;
            }
            continue;
        }
        const candidatePath = resolveWechatCommandPathCandidate(arg, params.workdir);
        if (!candidatePath || !isWechatPathWithinRoots(candidatePath, safePathRoots)) {
            return false;
        }
        pathArgCount += 1;
    }

    return pathArgCount > 0;
}

function isWechatSafeReadonlyExecSegment(segment: string, params?: {
    workdir?: string;
    safePathRoots?: string[];
}): {
    matched: boolean;
    command?: string;
} {
    const tokens = splitWechatShellTokens(segment);
    if (tokens.length === 0) {
        return { matched: false };
    }

    const execBase = normalizeWechatExecutableBase(tokens[0]);
    const args = tokens.slice(1).map((token) => unquoteWechatShellToken(token).trim());
    if (args.some((arg) => !arg || WECHAT_SAFE_READONLY_EXEC_SHELL_META_RE.test(arg))) {
        return { matched: false };
    }

    if (execBase === "date") {
        return {
            matched: args.every(isWechatSafeDateArg),
            command: execBase,
        };
    }
    if (execBase === "pwd") {
        return {
            matched: args.every((arg) => arg === "-L" || arg === "-P"),
            command: execBase,
        };
    }
    if (execBase === "whoami" || execBase === "hostname" || execBase === "arch") {
        return {
            matched: args.length === 0,
            command: execBase,
        };
    }
    if (execBase === "id") {
        return {
            matched: args.length === 0,
            command: execBase,
        };
    }
    if (execBase === "uname") {
        return {
            matched:
                args.length === 0 ||
                args.every((arg) =>
                    /^-[asnrvmpio]+$/.test(arg) ||
                    [
                        "--all",
                        "--kernel-name",
                        "--nodename",
                        "--kernel-release",
                        "--kernel-version",
                        "--machine",
                        "--processor",
                        "--hardware-platform",
                        "--operating-system",
                    ].includes(arg),
                ),
            command: execBase,
        };
    }

    if (execBase === "ls" || execBase === "stat" || execBase === "readlink") {
        return {
            matched: isWechatSafeReadonlyPathProbe({
                execBase,
                args,
                workdir: params?.workdir,
                safePathRoots: params?.safePathRoots,
            }),
            command: execBase,
        };
    }

    return { matched: false };
}

export function resolveWechatSafeReadonlyExecCommandMatch(command: string, workdir: string | undefined, safePathRoots?: string[]): {
    matched: boolean;
    command?: string;
    normalized?: string;
    wrappers?: string[];
    reason?: string;
} {
    const trimmed = command.trim();
    if (!trimmed) {
        return { matched: false, reason: "empty-command" };
    }
    if (/[\r\n]/.test(trimmed) || WECHAT_SAFE_READONLY_EXEC_SHELL_META_RE.test(trimmed)) {
        return { matched: false, reason: "shell-meta" };
    }

    const unwrapped = unwrapWechatInstalledSkillCommand(trimmed, workdir);
    if (unwrapped.wrappers.length > 0) {
        return { matched: false, reason: "wrapper-not-allowed" };
    }
    const normalized = unwrapped.command.trim();
    if (!normalized || /[\r\n]/.test(normalized) || WECHAT_SAFE_READONLY_EXEC_SHELL_META_RE.test(normalized)) {
        return { matched: false, reason: "unsafe-unwrapped-command" };
    }

    const segments = splitWechatShellSegments(normalized);
    if (segments.length !== 1) {
        return { matched: false, reason: "multiple-segments" };
    }

    const segmentMatch = isWechatSafeReadonlyExecSegment(segments[0], {
        workdir: unwrapped.workdir || workdir,
        safePathRoots,
    });
    if (!segmentMatch.matched) {
        return { matched: false, reason: "not-allowlisted" };
    }

    return {
        matched: true,
        command: segmentMatch.command,
        normalized,
        wrappers: unwrapped.wrappers,
    };
}
