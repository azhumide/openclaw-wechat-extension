"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ExtendsNever = ExtendsNever;
var _infer = require("../types/infer.mjs");
var _extends_right = require("./extends_right.mjs");
var Result = _interopRequireWildcard(require("./result.mjs"));function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);} // deno-fmt-ignore-file
function ExtendsNever(inferred, left, right) {
  return (0, _infer.IsInfer)(right) ?
  (0, _extends_right.ExtendsRight)(inferred, left, right) :
  Result.ExtendsTrue(inferred);
} /* v9-56087c85acd31d40 */
