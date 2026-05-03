"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.n = getActivePluginRegistryWorkspaceDirFromState;exports.r = getPluginRegistryState;exports.t = void 0; //#region src/plugins/runtime-state.ts
const PLUGIN_REGISTRY_STATE = exports.t = Symbol.for("openclaw.pluginRegistryState");
function getPluginRegistryState() {
  return globalThis[PLUGIN_REGISTRY_STATE];
}
function getActivePluginRegistryWorkspaceDirFromState() {
  return getPluginRegistryState()?.workspaceDir ?? void 0;
}
//#endregion /* v9-d1a37b10350e7094 */
