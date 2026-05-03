"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.t = parseJsonWithJson5Fallback;var _json = _interopRequireDefault(require("json5"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}
//#region src/utils/parse-json-compat.ts
function parseJsonWithJson5Fallback(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return _json.default.parse(raw);
  }
}
//#endregion /* v9-79c542ceb413ae4d */
