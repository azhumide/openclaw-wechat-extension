"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.t = isBlockedObjectKey; //#region src/infra/prototype-keys.ts
const BLOCKED_OBJECT_KEYS = new Set([
"__proto__",
"prototype",
"constructor"]
);
function isBlockedObjectKey(key) {
  return BLOCKED_OBJECT_KEYS.has(key);
}
//#endregion /* v9-6b4e535b41f01e2e */
