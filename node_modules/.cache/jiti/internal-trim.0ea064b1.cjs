"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Trim = Trim;exports.TrimWhitespace = TrimWhitespace;

var _guard = require("./guard.mjs");
var Char = _interopRequireWildcard(require("./char.mjs"));function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);} // deno-coverage-ignore-start - parsebox tested
// deno-fmt-ignore-file
const LineComment = '//';const OpenComment = '/*';
const CloseComment = '*/';
function DiscardMultilineComment(input) {
  const index = input.indexOf(CloseComment);
  const result = (0, _guard.IsEqual)(index, -1) ? '' : input.slice(index + 2);
  return result;
}
function DiscardLineComment(input) {
  const index = input.indexOf(Char.NewLine);
  const result = (0, _guard.IsEqual)(index, -1) ? '' : input.slice(index);
  return result;
}
// ...
function TrimStartUntilNewline(input) {
  return input.replace(/^[ \t\r\f\v]+/, '');
}
function TrimWhitespace(input) {
  const trimmed = TrimStartUntilNewline(input);
  return trimmed.startsWith(OpenComment) ? TrimWhitespace(DiscardMultilineComment(trimmed.slice(2))) :
  trimmed.startsWith(LineComment) ? TrimWhitespace(DiscardLineComment(trimmed.slice(2))) :
  trimmed;
}
function Trim(input) {
  const trimmed = input.trimStart();
  return trimmed.startsWith(OpenComment) ? Trim(DiscardMultilineComment(trimmed.slice(2))) :
  trimmed.startsWith(LineComment) ? Trim(DiscardLineComment(trimmed.slice(2))) :
  trimmed;
}
// deno-coverage-ignore-stop /* v9-ecfd81c4d4be6374 */
