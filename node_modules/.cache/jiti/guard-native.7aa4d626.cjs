"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsF32 = IsF32;exports.IsF64 = IsF64;exports.IsI16 = IsI16;exports.IsI32 = IsI32;exports.IsI64 = IsI64;exports.IsI8 = IsI8;exports.IsU16 = IsU16;exports.IsU32 = IsU32;exports.IsU64 = IsU64;exports.IsU8 = IsU8;var Guard = _interopRequireWildcard(require("./guard.mjs"));function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);}
// --------------------------------------------------------------------------
// Native
// --------------------------------------------------------------------------
/** Returns true if this value is a F32 */
function IsF32(value) {
  return Guard.IsNumber(value) &&
  Guard.IsEqual(value, Math.fround(value));
}
/** Returns true if this value is a F64 */
function IsF64(value) {
  return Guard.IsNumber(value);
}
/** Returns true if this value is a U8 */
function IsU8(value) {
  return Guard.IsInteger(value) &&
  Guard.IsGreaterEqualThan(value, 0) &&
  Guard.IsLessEqualThan(value, 255);
}
/** Returns true if this value is a U16 */
function IsU16(value) {
  return Guard.IsInteger(value) &&
  Guard.IsGreaterEqualThan(value, 0) &&
  Guard.IsLessEqualThan(value, 65535);
}
/** Returns true if this value is a U32 */
function IsU32(value) {
  return Guard.IsInteger(value) &&
  Guard.IsGreaterEqualThan(value, 0) &&
  Guard.IsLessEqualThan(value, 4294967295);
}
/** Returns true if this value is a U64 */
function IsU64(value) {
  return Guard.IsInteger(value) &&
  Guard.IsGreaterEqualThan(value, 0);
}
/** Returns true if this value is a I8 */
function IsI8(value) {
  return Guard.IsInteger(value) &&
  Guard.IsGreaterEqualThan(value, -128) &&
  Guard.IsLessEqualThan(value, 127);
}
/** Returns true if this value is a I16 */
function IsI16(value) {
  return Guard.IsInteger(value) &&
  Guard.IsGreaterEqualThan(value, -32768) &&
  Guard.IsLessEqualThan(value, 32767);
}
/** Returns true if this value is a I32 */
function IsI32(value) {
  return Guard.IsInteger(value) &&
  Guard.IsGreaterEqualThan(value, -2147483648) &&
  Guard.IsLessEqualThan(value, 2147483647);
}
/** Returns true if this value is a I64 */
function IsI64(value) {
  return Guard.IsBigInt(value) &&
  Guard.IsGreaterEqualThan(value, BigInt('-9223372036854775808')) &&
  Guard.IsLessEqualThan(value, BigInt('9223372036854775807'));
} /* v9-aad8bfe38b0c4189 */
