"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ExtendsArray = ExtendsArray;
var _array = require("../types/array.mjs");
var _immutable = require("../types/_immutable.mjs");
var _extends_right = require("./extends_right.mjs");
var _extends_left = require("./extends_left.mjs");
var Result = _interopRequireWildcard(require("./result.mjs"));function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);} // deno-fmt-ignore-file
function ExtendsImmutable(left, right) {
  const isImmutableLeft = (0, _immutable.IsImmutable)(left);
  const isImmutableRight = (0, _immutable.IsImmutable)(right);
  return isImmutableLeft && isImmutableRight ? true :
  !isImmutableLeft && isImmutableRight ? true :
  isImmutableLeft && !isImmutableRight ? false :
  true;
}
function ExtendsArray(inferred, arrayLeft, left, right) {
  return (0, _array.IsArray)(right) ?
  ExtendsImmutable(arrayLeft, right) ?
  (0, _extends_left.ExtendsLeft)(inferred, left, right.items) :
  Result.ExtendsFalse() :
  (0, _extends_right.ExtendsRight)(inferred, arrayLeft, right);
} /* v9-5c982a7835edd5d5 */
