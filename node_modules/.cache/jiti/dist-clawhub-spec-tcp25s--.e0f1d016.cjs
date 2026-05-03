"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.t = parseClawHubPluginSpec;var _stringCoerceBje8XVt = require("./string-coerce-Bje8XVt9.js");
//#region src/infra/clawhub-spec.ts
function parseClawHubPluginSpec(raw) {
  const trimmed = raw.trim();
  if (!(0, _stringCoerceBje8XVt.a)(trimmed).startsWith("clawhub:")) return null;
  const spec = trimmed.slice(8).trim();
  if (!spec) return null;
  const atIndex = spec.lastIndexOf("@");
  if (atIndex <= 0) return { name: spec };
  if (atIndex >= spec.length - 1) return null;
  const name = spec.slice(0, atIndex).trim();
  const version = spec.slice(atIndex + 1).trim();
  if (!name || !version) return null;
  return {
    name,
    version
  };
}
//#endregion /* v9-42323d3b00c50896 */
