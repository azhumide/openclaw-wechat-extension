"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.n = normalizeProfileName;exports.t = isValidProfileName;var _stringCoerceBje8XVt = require("./string-coerce-Bje8XVt9.js");
//#region src/cli/profile-utils.ts
const PROFILE_NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
function isValidProfileName(value) {
  if (!value) return false;
  return PROFILE_NAME_RE.test(value);
}
function normalizeProfileName(raw) {
  const profile = raw?.trim();
  if (!profile) return null;
  if ((0, _stringCoerceBje8XVt.a)(profile) === "default") return null;
  if (!isValidProfileName(profile)) return null;
  return profile;
}
//#endregion /* v9-36116b08e23cc2df */
