import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

function isWechatTruthyEnv(value: string | undefined): boolean | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
        return undefined;
    }
    if (["1", "true", "yes", "on"].includes(normalized)) {
        return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
        return false;
    }
    return undefined;
}

function hasWechatSupervisorHintEnv(): boolean {
    const keys = [
        "LAUNCH_JOB_LABEL",
        "LAUNCH_JOB_NAME",
        "XPC_SERVICE_NAME",
        "OPENCLAW_LAUNCHD_LABEL",
        "OPENCLAW_SYSTEMD_UNIT",
        "INVOCATION_ID",
        "SYSTEMD_EXEC_PID",
        "JOURNAL_STREAM",
        "OPENCLAW_WINDOWS_TASK_NAME",
        "OPENCLAW_SERVICE_MARKER",
    ];
    return keys.some((key) => {
        const value = process.env[key];
        return typeof value === "string" && value.trim().length > 0;
    });
}

export function resolveWechatBridgeAutostartDecision(): {
    shouldStart: boolean;
    reason: string;
} {
    const envOverride = isWechatTruthyEnv(process.env.OPENCLAW_WECHAT_BRIDGE_AUTOSTART);
    if (envOverride !== undefined) {
        return {
            shouldStart: envOverride,
            reason: `env-override:${envOverride ? "on" : "off"}`,
        };
    }

    const argv = process.argv.map((entry) => entry.trim().toLowerCase());
    const gatewayIndex = argv.lastIndexOf("gateway");
    const gatewaySubcommand = gatewayIndex >= 0 ? argv[gatewayIndex + 1] : "";
    const hasImplicitGatewayRun =
        gatewayIndex >= 0 &&
        (!gatewaySubcommand || gatewaySubcommand.startsWith("-"));
    if (gatewaySubcommand === "stop") {
        return {
            shouldStart: false,
            reason: "explicit-cli:gateway-stop",
        };
    }

    const serviceKind = process.env.OPENCLAW_SERVICE_KIND?.trim().toLowerCase();
    if (serviceKind === "gateway" || serviceKind === "node") {
        return {
            shouldStart: true,
            reason: `service-kind:${serviceKind}`,
        };
    }

    if (hasWechatSupervisorHintEnv()) {
        return {
            shouldStart: true,
            reason: "supervised-service",
        };
    }

    if (hasImplicitGatewayRun) {
        return {
            shouldStart: true,
            reason: "implicit-cli:gateway",
        };
    }

    if (gatewayIndex >= 0 && gatewaySubcommand === "run") {
        return {
            shouldStart: true,
            reason: "explicit-cli:gateway-run",
        };
    }

    return {
        shouldStart: true,
        reason: "default-on",
    };
}

export function maybeTriggerWechatBridgeStart(
    api: OpenClawPluginApi,
    reason: string,
    triggerBridgeStart: (api: OpenClawPluginApi) => void,
): boolean {
    const decision = resolveWechatBridgeAutostartDecision();
    if (!decision.shouldStart) {
        api.logger.debug?.(
            `[WeChat] Skipping bridge auto-start (${reason}); decision=${decision.reason}.`,
        );
        return false;
    }
    api.logger.debug?.(
        `[WeChat] Auto-starting bridge (${reason}); decision=${decision.reason}.`,
    );
    triggerBridgeStart(api);
    return true;
}
