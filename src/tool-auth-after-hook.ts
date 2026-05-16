import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import {
    resolveWechatInstalledSkillCommandMatch,
    summarizeWechatInstalledSkillMatch,
} from "./installed-skill-auth.js";
import { resolveWechatExtensionConfig } from "./config.js";
import { resolveWechatContextSessionKey } from "./message-tool.js";
import {
    getWechatToolAuthForRun,
    rememberWechatSkillToolSession,
} from "./runtime.js";
import {
    isWechatLogRecord,
    summarizeWechatToolAuthRecord,
    summarizeWechatToolParamsForLog,
    summarizeWechatToolResultForLog,
} from "./tool-log.js";

export type ClaimWechatToolAuthLogDedup = (params: {
    kind: string;
    runId?: string;
    toolName?: string;
    skillId?: string;
    detail?: string;
}) => boolean;

export function registerWechatToolAuthAfterHook(params: {
    api: OpenClawPluginApi;
    claimWechatToolAuthLogDedup: ClaimWechatToolAuthLogDedup;
}): void {
    const { api, claimWechatToolAuthLogDedup } = params;

    api.on("after_tool_call", (event, ctx) => {
        if (!ctx.runId) {
            return;
        }

        const toolName = event.toolName.trim().toLowerCase();
        const authContext = getWechatToolAuthForRun(ctx.runId);

        if (toolName === "web_fetch" && authContext) {
            const paramsSummary = summarizeWechatToolParamsForLog(
                toolName,
                isWechatLogRecord(event.params) ? event.params : undefined,
            );
            const resultSummary = summarizeWechatToolResultForLog(toolName, event.result, event.error);
            const durationSummary = typeof event.durationMs === "number" && Number.isFinite(event.durationMs)
                ? ` durationMs=${Math.max(0, Math.floor(event.durationMs))}`
                : "";
            const logger = event.error ? api.logger.warn : api.logger.info;
            logger?.(
                `[WeChat ToolTrace] tool=${toolName} phase=after runId=${ctx.runId}${durationSummary} ${paramsSummary} ${resultSummary} ${summarizeWechatToolAuthRecord(authContext)}`,
            );
        }

        if (toolName !== "exec" || !authContext) {
            return;
        }

        const cfg = api.runtime.config.current();
        const bridgeConfig = resolveWechatExtensionConfig(cfg, api.logger);
        if (!bridgeConfig.toolAuthAllowInstalledSkills) {
            return;
        }

        const toolParams = event.params as Record<string, unknown> | undefined;
        const command = typeof toolParams?.command === "string" ? toolParams.command : "";
        const workdir = typeof toolParams?.workdir === "string" ? toolParams.workdir : undefined;
        const installedSkillMatch = command
            ? resolveWechatInstalledSkillCommandMatch(command, workdir, bridgeConfig)
            : { matched: false };
        if (!installedSkillMatch.matched) {
            return;
        }

        const resultDetails = (event.result as any)?.details;
        const skillSessionId =
            resultDetails?.status === "running" && typeof resultDetails?.sessionId === "string"
                ? resultDetails.sessionId
                : undefined;
        if (!skillSessionId) {
            if (bridgeConfig.toolAuthDebugInstalledSkills) {
                const debugSummary = `reason=no-process-session-returned ${summarizeWechatInstalledSkillMatch(installedSkillMatch)}`;
                if (claimWechatToolAuthLogDedup({
                    kind: "installed-skill-debug",
                    runId: ctx.runId,
                    toolName: "exec",
                    skillId: installedSkillMatch.skillId,
                    detail: debugSummary,
                })) {
                    api.logger.info(
                        `[WeChat ToolAuth] Installed-skill debug tool=exec runId=${ctx.runId} ${debugSummary}`,
                    );
                }
            }
            return;
        }

        rememberWechatSkillToolSession({
            sessionId: skillSessionId,
            skillId: installedSkillMatch.skillId,
            sessionKey: resolveWechatContextSessionKey(ctx as Record<string, unknown>),
        });
        const installedSkillSummary = summarizeWechatInstalledSkillMatch(installedSkillMatch);
        api.logger.info(
            `[WeChat ToolAuth] Recorded installed-skill process session sessionId=${skillSessionId} runId=${ctx.runId}${installedSkillSummary ? ` ${installedSkillSummary}` : ""}`,
        );
        return;
    }, { priority: 100 });
}
