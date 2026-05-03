"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.t = resolveNodeRequireFromMeta; //#region src/logging/node-require.ts
function resolveNodeRequireFromMeta(metaUrl) {
  const getBuiltinModule = process.getBuiltinModule;
  if (typeof getBuiltinModule !== "function") return null;
  try {
    const moduleNamespace = getBuiltinModule("module");
    const createRequire = typeof moduleNamespace.createRequire === "function" ? moduleNamespace.createRequire : null;
    return createRequire ? createRequire(metaUrl) : null;
  } catch {
    return null;
  }
}
//#endregion /* v9-d36e1a3e1cc21c4d */
