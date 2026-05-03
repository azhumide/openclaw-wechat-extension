"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.a = generateSecureUuid;exports.i = generateSecureToken;exports.n = generateSecureHex;exports.r = generateSecureInt;exports.t = generateSecureFraction;var _nodeCrypto = require("node:crypto");
//#region src/infra/secure-random.ts
function generateSecureUuid() {
  return (0, _nodeCrypto.randomUUID)();
}
function generateSecureToken(bytes = 16) {
  return (0, _nodeCrypto.randomBytes)(bytes).toString("base64url");
}
function generateSecureHex(bytes = 16) {
  return (0, _nodeCrypto.randomBytes)(bytes).toString("hex");
}
/** Returns a cryptographically secure fraction in the range [0, 1). */
function generateSecureFraction() {
  return (0, _nodeCrypto.randomBytes)(4).readUInt32BE(0) / 4294967296;
}
function generateSecureInt(a, b) {
  return typeof b === "number" ? (0, _nodeCrypto.randomInt)(a, b) : (0, _nodeCrypto.randomInt)(a);
}
//#endregion /* v9-fdf6f4b169eb0c8e */
