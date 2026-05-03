"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.i = toAgentModelListLike;exports.n = resolveAgentModelPrimaryValue;exports.r = resolveAgentModelTimeoutMsValue;exports.t = resolveAgentModelFallbackValues;var _stringCoerceBje8XVt = require("./string-coerce-Bje8XVt9.js");
//#region src/config/model-input.ts
function resolveAgentModelPrimaryValue(model) {
  return (0, _stringCoerceBje8XVt.p)(model);
}
function resolveAgentModelFallbackValues(model) {
  if (!model || typeof model !== "object") return [];
  return Array.isArray(model.fallbacks) ? model.fallbacks : [];
}
function resolveAgentModelTimeoutMsValue(model) {
  if (!model || typeof model !== "object") return;
  return typeof model.timeoutMs === "number" && Number.isFinite(model.timeoutMs) && model.timeoutMs > 0 ? Math.floor(model.timeoutMs) : void 0;
}
function toAgentModelListLike(model) {
  if (typeof model === "string") {
    const primary = (0, _stringCoerceBje8XVt.c)(model);
    return primary ? { primary } : void 0;
  }
  if (!model || typeof model !== "object") return;
  return model;
}
//#endregion /* v9-52ca982053ae7b32 */
