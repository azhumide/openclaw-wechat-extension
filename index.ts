import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk/core";
import {
    closeWechatBridgeResources,
    getWechatBridgeGlobalState,
    logWechatBridgeState,
    markWechatApiBound,
    maybeRecoverWechatBridgeOnDuplicateRegister,
    syncWechatBridgeModuleRefsFromState,
    triggerWechatBridgeStart,
} from "./src/bridge-runtime.js";
import { maybeTriggerWechatBridgeStart } from "./src/bridge-autostart.js";
import { wechatPlugin } from "./src/channel.js";
import { resolveWechatExtensionConfig } from "./src/config.js";
import {
    claimWechatToolAuthLogDedup,
    sendWechatToolAuthNotice,
} from "./src/dedup.js";
import {
    handleInboundMessage,
    WECHAT_EXTENSION_BUILD_MARKER,
} from "./src/inbound-handler.js";
import {
    resolveWechatContextBody,
    resolveWechatContextSenderId,
    resolveWechatContextSessionKey,
} from "./src/message-tool.js";
import {
    promoteWechatToolAuthForDispatch,
    setWechatRuntime,
    summarizeWechatToolAuthDebugState,
} from "./src/runtime.js";
import { registerWechatSubagentLifecycleHooks } from "./src/subagent-hooks.js";
import { registerWechatToolAuthAfterHook } from "./src/tool-auth-after-hook.js";
import { registerWechatToolAuthBeforeHooks } from "./src/tool-auth-before-hook.js";
import { shouldApplyWechatToolAuth } from "./src/tool-auth-notice.js";

function triggerBridgeStart(api: OpenClawPluginApi): void {
    triggerWechatBridgeStart(api, handleInboundMessage);
}


const plugin = {
    id: "wechat",
    name: "WeChat",
    description: "WeChat channel plugin (WS bridge)",
    configSchema: emptyPluginConfigSchema(),
    register(api: OpenClawPluginApi) {
        try {
            api.logger.debug(`[WeChat] Registering plugin package... (PID: ${process.pid})`);
            const sharedState = getWechatBridgeGlobalState();
            if (sharedState.registering) {
                setWechatRuntime(api.runtime);
                sharedState.runtime = api.runtime;
                bindApiHandlers();
                sharedState.duplicateRegisterCount = (sharedState.duplicateRegisterCount || 0) + 1;
                if (sharedState.duplicateRegisterCount === 1) {
                    api.logger.debug(
                        "[WeChat] Plugin register re-entered while initial registration is still in progress; suppressing duplicate call.",
                    );
                }
                return;
            }
            if (sharedState.registered) {
                setWechatRuntime(api.runtime);
                sharedState.runtime = api.runtime;
                syncWechatBridgeModuleRefsFromState(sharedState);
                bindApiHandlers();
                sharedState.duplicateRegisterCount = (sharedState.duplicateRegisterCount || 0) + 1;
                if (sharedState.duplicateRegisterCount === 1) {
                    api.logger.debug?.(
                        "[WeChat] Plugin register called again in the same process; skipping duplicate registration.",
                    );
                    logWechatBridgeState(api, "register:duplicate", sharedState);
                } else if (sharedState.duplicateRegisterCount % 100 === 0) {
                    api.logger.debug(
                        `[WeChat] Duplicate plugin register suppressed count=${sharedState.duplicateRegisterCount}.`,
                    );
                }

                maybeRecoverWechatBridgeOnDuplicateRegister({
                    api,
                    state: sharedState,
                    triggerBridgeStart: (bridgeApi) =>
                        void maybeTriggerWechatBridgeStart(
                            bridgeApi,
                            "duplicate-register recovery",
                            triggerBridgeStart,
                        ),
                });
                return;
            }
            sharedState.registering = true;
            sharedState.registered = true;
            sharedState.duplicateRegisterCount = 0;
            sharedState.lastDuplicateRegisterLogAt = 0;
            sharedState.lastRecoveryAttemptAt = 0;
            sharedState.lastRecoveryLogAt = 0;
            setWechatRuntime(api.runtime);

            bindApiHandlers();

            maybeTriggerWechatBridgeStart(api, "plugin register", triggerBridgeStart);
            sharedState.registering = false;

            api.logger.info(`[WeChat] Registration complete build=${WECHAT_EXTENSION_BUILD_MARKER}`);
            api.logger.debug("[WeChat] Registration complete.");
        } catch (err: any) {
            const sharedState = getWechatBridgeGlobalState();
            sharedState.registering = false;
            sharedState.registered = false;
            api.logger.error(`[WeChat] Registration error: ${err.message}`);
        }

        function bindApiHandlers() {
            if (!markWechatApiBound(api)) {
                return;
            }
            const sharedState = getWechatBridgeGlobalState();

            api.on("before_dispatch", (event, ctx) => {
                const sessionKey = resolveWechatContextSessionKey(ctx as Record<string, unknown>);
                if (!shouldApplyWechatToolAuth({ sessionKey })) {
                    return;
                }

                const promotedAuth = promoteWechatToolAuthForDispatch({
                    sessionKey: sessionKey!,
                    senderId: resolveWechatContextSenderId(ctx as Record<string, unknown>, event.senderId),
                    content: resolveWechatContextBody(ctx as Record<string, unknown>, event.body || event.content),
                });
                if (!promotedAuth) {
                    const dispatchSenderId = resolveWechatContextSenderId(ctx as Record<string, unknown>, event.senderId) || "";
                    api.logger.warn?.(
                        `[WeChat ToolAuth] No pending auth matched during dispatch ${summarizeWechatToolAuthDebugState({
                            sessionKey,
                        })} senderId=${dispatchSenderId}`,
                    );
                }

                return;
            }, { priority: 10_000 });

            registerWechatToolAuthBeforeHooks({
                api,
                resolveWechatExtensionConfig,
                claimWechatToolAuthLogDedup,
                sendWechatToolAuthNotice,
            });
            registerWechatToolAuthAfterHook({
                api,
                claimWechatToolAuthLogDedup,
            });
            registerWechatSubagentLifecycleHooks(api);

            sharedState.runtime = api.runtime;
            syncWechatBridgeModuleRefsFromState(sharedState);
            logWechatBridgeState(api, "register:init", sharedState);

            api.registerChannel({ plugin: wechatPlugin });
        }
    },
    unregister(api: OpenClawPluginApi) {
        const state = getWechatBridgeGlobalState();
        state.boundApis.delete(api as object);
        state.registering = false;
        state.registered = false;
        state.duplicateRegisterCount = 0;
        state.lastDuplicateRegisterLogAt = 0;
        state.lastRecoveryAttemptAt = 0;
        state.lastRecoveryLogAt = 0;
        logWechatBridgeState(api, "unregister:before");
        void closeWechatBridgeResources(api, "plugin unregister");
    }
};

export default plugin;
