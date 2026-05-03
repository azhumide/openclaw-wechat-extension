"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.t = unwrapDefaultModuleExport; //#region src/plugins/module-export.ts
function unwrapDefaultModuleExport(moduleExport) {
  let resolved = moduleExport;
  const seen = /* @__PURE__ */new Set();
  while (resolved && typeof resolved === "object" && "default" in resolved && !seen.has(resolved)) {
    seen.add(resolved);
    resolved = resolved.default;
  }
  return resolved;
}
//#endregion /* v9-179c5c2f84648a21 */
