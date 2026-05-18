import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { resolveWechatExtensionConfig } from "./config.js";
import {
    buildWechatInstalledSkillDebugSummary,
    resolveWechatInstalledSkillCommandMatch,
    resolveWechatSafeReadonlyExecCommandMatch,
    resolveWechatSafeReadonlyExecRoots,
    summarizeWechatInstalledSkillMatch,
    type WechatInstalledSkillMatchInfo,
} from "./installed-skill-auth.js";
import {
    getWechatSkillToolSession,
} from "./runtime.js";
import { summarizeWechatTextForLog } from "./text.js";

export type ClaimWechatToolAuthLogDedup = (params: {
    kind: string;
    runId?: string;
    toolName?: string;
    skillId?: string;
    detail?: string;
}) => boolean;

export type WechatInstalledSkillAuthState = {
    execCommand?: string;
    execWorkdir?: string;
    processSessionId?: string;
    shouldInspectInstalledSkill: boolean;
    installedSkillMatch: WechatInstalledSkillMatchInfo;
    installedSkillProcessSession?: {
        skillId?: string;
    };
    isInstalledSkillProcessSession: boolean;
    isInstalledSkillBypass: boolean;
    blockedSkillId?: string;
    installedSkillSummary: string;
};

export function resolveWechatInstalledSkillAuthState(params: {
    toolName: string;
    eventParams?: unknown;
    bridgeConfig: ReturnType<typeof resolveWechatExtensionConfig>;
    blockedSkills: Set<string>;
}): WechatInstalledSkillAuthState {
    const eventParams = params.eventParams && typeof params.eventParams === "object"
        ? params.eventParams as Record<string, unknown>
        : undefined;
    const execCommand =
        params.toolName === "exec" && typeof eventParams?.command === "string"
            ? eventParams.command
            : undefined;
    const execWorkdir =
        params.toolName === "exec" && typeof eventParams?.workdir === "string"
            ? eventParams.workdir
            : undefined;
    const processSessionId =
        params.toolName === "process" && typeof eventParams?.sessionId === "string"
            ? eventParams.sessionId
            : undefined;
    const shouldInspectInstalledSkill =
        params.toolName === "exec" &&
        typeof execCommand === "string" &&
        (
            params.bridgeConfig.toolAuthAllowInstalledSkills ||
            params.bridgeConfig.toolAuthDebugInstalledSkills ||
            params.blockedSkills.size > 0
        );
    const installedSkillMatch =
        shouldInspectInstalledSkill
            ? resolveWechatInstalledSkillCommandMatch(
                execCommand!,
                execWorkdir,
                params.bridgeConfig,
            )
            : { matched: false };
    const installedSkillProcessSession =
        processSessionId
            ? getWechatSkillToolSession(processSessionId)
            : undefined;
    const isInstalledSkillProcessSession =
        params.toolName === "process" &&
        params.bridgeConfig.toolAuthAllowInstalledSkills &&
        Boolean(processSessionId) &&
        Boolean(installedSkillProcessSession);
    const isInstalledSkillBypass =
        params.bridgeConfig.toolAuthAllowInstalledSkills &&
        (installedSkillMatch.matched || isInstalledSkillProcessSession);
    const matchedSkillId =
        (installedSkillMatch.skillId || installedSkillProcessSession?.skillId || "").trim().toLowerCase();
    const blockedSkillId =
        matchedSkillId && params.blockedSkills.has(matchedSkillId)
            ? matchedSkillId
            : undefined;
    const installedSkillSummary = installedSkillMatch.matched
        ? summarizeWechatInstalledSkillMatch(installedSkillMatch)
        : (
            isInstalledSkillProcessSession && processSessionId
                ? `reason=process-session sessionId=${processSessionId}${installedSkillProcessSession?.skillId ? ` skill=${installedSkillProcessSession.skillId}` : ""}`
                : ""
        );

    return {
        execCommand,
        execWorkdir,
        processSessionId,
        shouldInspectInstalledSkill,
        installedSkillMatch,
        installedSkillProcessSession,
        isInstalledSkillProcessSession,
        isInstalledSkillBypass,
        blockedSkillId,
        installedSkillSummary,
    };
}

export function maybeBypassWechatSafeReadonlyExec(params: {
    api: OpenClawPluginApi;
    toolName: string;
    effectiveRunId?: string;
    bridgeConfig: ReturnType<typeof resolveWechatExtensionConfig>;
    authSummary: string;
    authContext: {
        isMaster?: boolean;
    };
    isBypassWxid: boolean;
    isInstalledSkillBypass: boolean;
    execCommand?: string;
    execWorkdir?: string;
    eventParams?: unknown;
}): undefined | {
    params: Record<string, unknown>;
} {
    if (
        params.toolName !== "exec" ||
        !params.execCommand ||
        !params.bridgeConfig.toolAuthAllowSafeReadonlyExec ||
        params.authContext.isMaster ||
        params.isBypassWxid ||
        params.isInstalledSkillBypass
    ) {
        return undefined;
    }

    const safeReadonlyExecMatch = resolveWechatSafeReadonlyExecCommandMatch(
        params.execCommand,
        params.execWorkdir,
        resolveWechatSafeReadonlyExecRoots(params.bridgeConfig),
    );
    if (!safeReadonlyExecMatch.matched) {
        return undefined;
    }

    params.api.logger.info(
        `[WeChat ToolAuth] Safe-readonly exec bypass runId=${params.effectiveRunId || ""} ` +
        `command=${safeReadonlyExecMatch.command || "unknown"} ` +
        `segment="${summarizeWechatTextForLog(safeReadonlyExecMatch.normalized || params.execCommand, 120)}"` +
        `${safeReadonlyExecMatch.wrappers?.length ? ` via=${safeReadonlyExecMatch.wrappers.join(">")}` : ""} ` +
        `${params.authSummary}`,
    );
    return {
        params: {
            ...(params.eventParams && typeof params.eventParams === "object" ? params.eventParams as Record<string, unknown> : {}),
            ask: "off",
        },
    };
}

export function logWechatInstalledSkillDebugIfNeeded(params: {
    api: OpenClawPluginApi;
    bridgeConfig: ReturnType<typeof resolveWechatExtensionConfig>;
    toolName: string;
    effectiveRunId?: string;
    contextRunId?: string;
    authSummary: string;
    state: WechatInstalledSkillAuthState;
    claimWechatToolAuthLogDedup: ClaimWechatToolAuthLogDedup;
}): void {
    if (
        params.bridgeConfig.toolAuthDebugInstalledSkills &&
        params.state.shouldInspectInstalledSkill &&
        !params.state.installedSkillMatch.matched
    ) {
        const debugSummary = buildWechatInstalledSkillDebugSummary(
            params.state.execCommand!,
            params.state.execWorkdir,
            params.bridgeConfig,
        );
        if (params.claimWechatToolAuthLogDedup({
            kind: "installed-skill-debug",
            runId: params.effectiveRunId,
            toolName: params.toolName,
            detail: debugSummary,
        })) {
            params.api.logger.info(
                `[WeChat ToolAuth] Installed-skill debug tool=${params.toolName} runId=${params.contextRunId} ${debugSummary} ${params.authSummary}`,
            );
        }
    }

    if (
        params.bridgeConfig.toolAuthDebugInstalledSkills &&
        params.toolName === "process" &&
        params.bridgeConfig.toolAuthAllowInstalledSkills &&
        params.state.processSessionId &&
        !params.state.isInstalledSkillProcessSession
    ) {
        const debugSummary = `reason=unknown-process-session sessionId=${params.state.processSessionId}`;
        if (params.claimWechatToolAuthLogDedup({
            kind: "installed-skill-debug",
            runId: params.effectiveRunId,
            toolName: params.toolName,
            detail: debugSummary,
        })) {
            params.api.logger.info(
                `[WeChat ToolAuth] Installed-skill debug tool=${params.toolName} runId=${params.contextRunId} ${debugSummary} ${params.authSummary}`,
            );
        }
    }
}

function describeWechatSafeReadonlyDenyReason(reason?: string): string | undefined {
    switch (reason) {
        case "shell-meta":
        case "unsafe-unwrapped-command":
            return "the command uses shell control characters such as pipes, redirection, variable expansion, or command substitution";
        case "multiple-segments":
            return "the command contains multiple shell segments";
        case "wrapper-not-allowed":
            return "the command is wrapped in a shell or another interpreter";
        case "not-allowlisted":
            return "the command or target path is outside the safe readonly allowlist";
        case "empty-command":
            return "the command is empty";
        default:
            return undefined;
    }
}

export function buildWechatDeniedToolAuthModelReason(params: {
    toolName: string;
    bridgeConfig: ReturnType<typeof resolveWechatExtensionConfig>;
    state: WechatInstalledSkillAuthState;
}): string | undefined {
    if (params.toolName !== "exec" || !params.state.execCommand) {
        return undefined;
    }

    const reasons: string[] = [];
    if (params.bridgeConfig.toolAuthAllowSafeReadonlyExec) {
        const safeReadonlyExecMatch = resolveWechatSafeReadonlyExecCommandMatch(
            params.state.execCommand,
            params.state.execWorkdir,
            resolveWechatSafeReadonlyExecRoots(params.bridgeConfig),
        );
        if (!safeReadonlyExecMatch.matched) {
            const safeReadonlyReason = describeWechatSafeReadonlyDenyReason(safeReadonlyExecMatch.reason);
            reasons.push(
                safeReadonlyReason
                    ? `it is not eligible for the safe-readonly exec bypass because ${safeReadonlyReason}`
                    : "it is not eligible for the safe-readonly exec bypass",
            );
        }
    }

    if (
        params.bridgeConfig.toolAuthAllowInstalledSkills &&
        params.state.shouldInspectInstalledSkill &&
        !params.state.installedSkillMatch.matched
    ) {
        reasons.push("it did not match a trusted installed-skill command");
    }

    return reasons.join("; ") || undefined;
}

export function maybeHandleWechatTrustedToolBypass(params: {
    api: OpenClawPluginApi;
    toolName: string;
    effectiveRunId?: string;
    eventParams?: unknown;
    bridgeConfig: ReturnType<typeof resolveWechatExtensionConfig>;
    authContext: {
        isMaster?: boolean;
    };
    authSummary: string;
    isBypassWxid: boolean;
    bypassSource?: string;
    bypassMatch: {
        kind?: string;
        value?: string;
    };
    isInstalledSkillBypass: boolean;
    isInstalledSkillProcessSession: boolean;
    installedSkillReason?: string;
    installedSkillSummary: string;
}): undefined | {
    handled: true;
    result?: {
        params: Record<string, unknown>;
    };
} {
    if (!params.authContext.isMaster && !params.isBypassWxid && !params.isInstalledSkillBypass) {
        return undefined;
    }

    if (
        params.toolName === "exec" &&
        (params.bridgeConfig.ownerExecBypassApproval || params.isInstalledSkillBypass) &&
        params.eventParams &&
        typeof params.eventParams === "object"
    ) {
        params.api.logger.info(
            `[WeChat ToolAuth] Trusted bypass tool=${params.toolName} runId=${params.effectiveRunId || ""} source=${
                params.authContext.isMaster
                    ? "master"
                    : params.isInstalledSkillBypass
                        ? `installed-skill:${params.isInstalledSkillProcessSession ? "process-session" : (params.installedSkillReason || "matched")}`
                        : `${params.bypassSource || "whitelist"}:${params.bypassMatch.kind || "unknown"}`
            }${params.installedSkillSummary ? ` ${params.installedSkillSummary}` : ""} ${params.authSummary}`,
        );
        return {
            handled: true,
            result: {
                params: {
                    ...(params.eventParams as Record<string, unknown>),
                    ask: "off",
                },
            },
        };
    }

    if (params.isBypassWxid) {
        params.api.logger.info(
            `[WeChat ToolAuth] Whitelist bypass tool=${params.toolName} runId=${params.effectiveRunId || ""} source=${params.bypassSource || "whitelist"} matchedBy=${params.bypassMatch.kind || "unknown"} value=${params.bypassMatch.value || ""} ${params.authSummary}`,
        );
    }
    if (params.isInstalledSkillBypass) {
        params.api.logger.info(
            `[WeChat ToolAuth] Installed-skill bypass tool=${params.toolName} runId=${params.effectiveRunId || ""}${params.installedSkillSummary ? ` ${params.installedSkillSummary}` : ""} ${params.authSummary}`,
        );
    }

    return {
        handled: true,
    };
}
