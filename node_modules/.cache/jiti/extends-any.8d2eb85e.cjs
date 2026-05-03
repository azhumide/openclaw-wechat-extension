"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ExtendsAny = ExtendsAny;
var _infer = require("../types/infer.mjs");
var _any = require("../types/any.mjs");
var _unknown = require("../types/unknown.mjs");
var _extends_right = require("./extends_right.mjs");
var Result = _interopRequireWildcard(require("./result.mjs"));function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);} // deno-fmt-ignore-file
function ExtendsAny(inferred, left, right) {
  return (0, _infer.IsInfer)(right) ? (0, _extends_right.ExtendsRight)(inferred, left, right) :
  (0, _any.IsAny)(right) ? Result.ExtendsTrue(inferred) :
  (0, _unknown.IsUnknown)(right) ? Result.ExtendsTrue(inferred) :
  Result.ExtendsUnion(inferred);
} /* v9-075dd655f7f8ba60 */
