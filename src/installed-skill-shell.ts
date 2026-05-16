import * as path from "node:path";

export const WECHAT_SKILL_SCRIPT_EXTENSIONS = new Set([
    ".py",
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".sh",
    ".ps1",
    ".bat",
    ".cmd",
]);

const WECHAT_SHELL_WRAPPER_EXECUTABLES = new Set([
    "ash",
    "bash",
    "cmd",
    "dash",
    "fish",
    "ksh",
    "powershell",
    "pwsh",
    "sh",
    "zsh",
]);

export const WECHAT_SAFE_READONLY_EXEC_SHELL_META_RE = /[;&|<>`$]/;

export function splitWechatShellTokens(command: string): string[] {
    const tokens = command.match(/"([^"\\]|\\.)*"|'[^']*'|\S+/g);
    return tokens ? tokens.map((token) => token.trim()).filter(Boolean) : [];
}

export function unquoteWechatShellToken(token: string): string {
    const trimmed = token.trim();
    if (
        (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

export function splitWechatShellSegments(command: string): string[] {
    const segments: string[] = [];
    let current = "";
    let inSingle = false;
    let inDouble = false;
    let escaped = false;

    const pushCurrent = () => {
        const trimmed = current.trim();
        if (trimmed) {
            segments.push(trimmed);
        }
        current = "";
    };

    for (let index = 0; index < command.length; index += 1) {
        const ch = command[index];
        const next = command[index + 1];

        if (escaped) {
            current += ch;
            escaped = false;
            continue;
        }

        if (!inSingle && ch === "\\") {
            current += ch;
            escaped = true;
            continue;
        }

        if (ch === "'" && !inDouble) {
            inSingle = !inSingle;
            current += ch;
            continue;
        }
        if (ch === "\"" && !inSingle) {
            inDouble = !inDouble;
            current += ch;
            continue;
        }

        if (!inSingle && !inDouble) {
            if ((ch === "&" && next === "&") || (ch === "|" && next === "|")) {
                pushCurrent();
                index += 1;
                continue;
            }
            if (ch === ";" || ch === "\n" || ch === "\r") {
                pushCurrent();
                continue;
            }
        }

        current += ch;
    }

    pushCurrent();
    return segments;
}

export function normalizeWechatExecutableBase(token: string): string {
    const normalized = path.basename(unquoteWechatShellToken(token)).trim().toLowerCase();
    if (normalized.endsWith(".exe")) {
        return normalized.slice(0, -4);
    }
    return normalized;
}

function isWechatEnvAssignmentToken(token: string): boolean {
    return /^[A-Za-z_][A-Za-z0-9_]*=.*/.test(unquoteWechatShellToken(token).trim());
}

function stripWechatEnvWrapper(params: {
    tokens: string[];
    workdir?: string;
}): {
    changed: boolean;
    tokens: string[];
    workdir?: string;
    wrapper?: string;
} {
    if (params.tokens.length === 0 || normalizeWechatExecutableBase(params.tokens[0]) !== "env") {
        return {
            changed: false,
            tokens: params.tokens,
            workdir: params.workdir,
        };
    }

    let index = 1;
    let nextWorkdir = params.workdir;
    while (index < params.tokens.length) {
        const raw = unquoteWechatShellToken(params.tokens[index]).trim();
        const lower = raw.toLowerCase();
        if (!raw) {
            index += 1;
            continue;
        }
        if (raw === "--") {
            index += 1;
            break;
        }
        if (isWechatEnvAssignmentToken(params.tokens[index])) {
            index += 1;
            continue;
        }
        if (lower === "-i" || lower === "--ignore-environment" || lower === "-0" || lower === "--null") {
            index += 1;
            continue;
        }
        if (lower === "-u" || lower === "--unset") {
            index += 2;
            continue;
        }
        if (lower === "-c" || lower === "--chdir") {
            const target = index + 1 < params.tokens.length
                ? resolveWechatCommandPathCandidate(params.tokens[index + 1], params.workdir)
                : null;
            if (target) {
                nextWorkdir = target;
            }
            index += 2;
            continue;
        }
        if (raw.startsWith("-")) {
            return {
                changed: false,
                tokens: params.tokens,
                workdir: params.workdir,
            };
        }
        break;
    }

    if (index >= params.tokens.length) {
        return {
            changed: false,
            tokens: params.tokens,
            workdir: params.workdir,
        };
    }

    return {
        changed: true,
        tokens: params.tokens.slice(index),
        workdir: nextWorkdir,
        wrapper: "env",
    };
}

function extractWechatShellInlineCommand(params: {
    tokens: string[];
    workdir?: string;
}): {
    changed: boolean;
    command?: string;
    workdir?: string;
    wrapper?: string;
} {
    if (params.tokens.length < 2) {
        return { changed: false, workdir: params.workdir };
    }

    const execBase = normalizeWechatExecutableBase(params.tokens[0]);
    if (!WECHAT_SHELL_WRAPPER_EXECUTABLES.has(execBase)) {
        return { changed: false, workdir: params.workdir };
    }

    const readCommandAt = (index: number) => {
        if (index + 1 >= params.tokens.length) {
            return { changed: false, workdir: params.workdir };
        }
        const innerCommand = unquoteWechatShellToken(params.tokens[index + 1]).trim();
        if (!innerCommand) {
            return { changed: false, workdir: params.workdir };
        }
        return {
            changed: true,
            command: innerCommand,
            workdir: params.workdir,
            wrapper: execBase,
        };
    };

    for (let index = 1; index < params.tokens.length; index += 1) {
        const raw = unquoteWechatShellToken(params.tokens[index]).trim();
        const lower = raw.toLowerCase();
        if (!raw) {
            continue;
        }

        if (execBase === "cmd" && lower === "/c") {
            return readCommandAt(index);
        }
        if ((execBase === "powershell" || execBase === "pwsh") && (lower === "-c" || lower === "-command")) {
            return readCommandAt(index);
        }
        if (execBase !== "cmd" && execBase !== "powershell" && execBase !== "pwsh") {
            if (lower === "-c" || /^-[a-z]*c[a-z]*$/i.test(lower)) {
                return readCommandAt(index);
            }
        }
    }

    return { changed: false, workdir: params.workdir };
}

export function unwrapWechatInstalledSkillCommand(command: string, workdir: string | undefined): {
    command: string;
    workdir?: string;
    wrappers: string[];
} {
    let currentCommand = command.trim();
    let currentWorkdir = workdir;
    const wrappers: string[] = [];

    for (let depth = 0; depth < 4; depth += 1) {
        const tokens = splitWechatShellTokens(currentCommand);
        if (tokens.length === 0) {
            break;
        }

        const envUnwrap = stripWechatEnvWrapper({
            tokens,
            workdir: currentWorkdir,
        });
        if (envUnwrap.changed) {
            currentCommand = envUnwrap.tokens.join(" ").trim();
            currentWorkdir = envUnwrap.workdir;
            if (envUnwrap.wrapper) {
                wrappers.push(envUnwrap.wrapper);
            }
            continue;
        }

        const shellUnwrap = extractWechatShellInlineCommand({
            tokens,
            workdir: currentWorkdir,
        });
        if (shellUnwrap.changed && shellUnwrap.command) {
            currentCommand = shellUnwrap.command;
            currentWorkdir = shellUnwrap.workdir;
            if (shellUnwrap.wrapper) {
                wrappers.push(shellUnwrap.wrapper);
            }
            continue;
        }

        break;
    }

    return {
        command: currentCommand,
        workdir: currentWorkdir,
        wrappers,
    };
}

export function resolveWechatCommandPathCandidate(token: string, workdir?: string): string | null {
    const raw = unquoteWechatShellToken(token);
    if (!raw) {
        return null;
    }
    const looksLikePath =
        raw.includes("/") ||
        raw.includes("\\") ||
        raw.startsWith(".") ||
        raw.startsWith("~") ||
        raw.toLowerCase() === "skill.md" ||
        WECHAT_SKILL_SCRIPT_EXTENSIONS.has(path.extname(raw).toLowerCase());
    if (!looksLikePath) {
        return null;
    }
    const expanded = raw.startsWith("~")
        ? path.join(
              process.env.HOME || process.env.USERPROFILE || "",
              raw.length > 1 && (raw[1] === "/" || raw[1] === "\\") ? raw.slice(2) : raw.slice(1)
          )
        : raw;
    const baseDir = workdir?.trim() ? workdir : process.cwd();
    return path.resolve(baseDir, expanded);
}

export function isWechatPathWithinRoots(filePath: string, roots: string[]): boolean {
    return roots.some((root) => {
        const relative = path.relative(root, filePath);
        return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
    });
}
