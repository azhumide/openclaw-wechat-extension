"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.i = listRouteBindings;exports.n = listAcpBindings;exports.r = listConfiguredBindings;exports.t = isRouteBinding; //#region src/config/bindings.ts
function normalizeBindingType(binding) {
  return binding.type === "acp" ? "acp" : "route";
}
function isRouteBinding(binding) {
  return normalizeBindingType(binding) === "route";
}
function isAcpBinding(binding) {
  return normalizeBindingType(binding) === "acp";
}
function listConfiguredBindings(cfg) {
  return Array.isArray(cfg.bindings) ? cfg.bindings : [];
}
function listRouteBindings(cfg) {
  return listConfiguredBindings(cfg).filter(isRouteBinding);
}
function listAcpBindings(cfg) {
  return listConfiguredBindings(cfg).filter(isAcpBinding);
}
//#endregion /* v9-a509ca467de61a0d */
