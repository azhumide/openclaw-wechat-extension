"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Entries = Entries;exports.EntriesRegExp = EntriesRegExp;exports.Every = Every;exports.EveryAll = EveryAll;exports.GraphemeCount = GraphemeCount;exports.HasPropertyKey = HasPropertyKey;exports.IsArray = IsArray;exports.IsAsyncIterator = IsAsyncIterator;exports.IsBigInt = IsBigInt;exports.IsBoolean = IsBoolean;exports.IsClassInstance = IsClassInstance;exports.IsConstructor = IsConstructor;exports.IsDeepEqual = IsDeepEqual;exports.IsEqual = IsEqual;exports.IsFunction = IsFunction;exports.IsGreaterEqualThan = IsGreaterEqualThan;exports.IsGreaterThan = IsGreaterThan;exports.IsInteger = IsInteger;exports.IsIterator = IsIterator;exports.IsLessEqualThan = IsLessEqualThan;exports.IsLessThan = IsLessThan;exports.IsMaxLength = IsMaxLength;exports.IsMinLength = IsMinLength;exports.IsMultipleOf = IsMultipleOf;exports.IsNull = IsNull;exports.IsNumber = IsNumber;exports.IsObject = IsObject;exports.IsObjectNotArray = IsObjectNotArray;exports.IsString = IsString;exports.IsSymbol = IsSymbol;exports.IsUndefined = IsUndefined;exports.IsUnsafePropertyKey = IsUnsafePropertyKey;exports.IsValueLike = IsValueLike;exports.Keys = Keys;exports.Symbols = Symbols;exports.TakeLeft = TakeLeft;exports.Values = Values;var String = _interopRequireWildcard(require("./string.mjs"));function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);}
// --------------------------------------------------------------------------
// Guards
// --------------------------------------------------------------------------
/** Returns true if this value is an array */
function IsArray(value) {
  return Array.isArray(value);
}
/** Returns true if this value is an async iterator */
function IsAsyncIterator(value) {
  return IsObject(value) && Symbol.asyncIterator in value;
}
/** Returns true if this value is bigint */
function IsBigInt(value) {
  return IsEqual(typeof value, 'bigint');
}
/** Returns true if this value is a boolean */
function IsBoolean(value) {
  return IsEqual(typeof value, 'boolean');
}
/** Returns true if this value is a constructor */
function IsConstructor(value) {
  if (IsUndefined(value) || !IsFunction(value))
  return false;
  const result = Function.prototype.toString.call(value);
  if (/^class\s/.test(result))
  return true;
  if (/\[native code\]/.test(result))
  return true;
  return false;
}
/** Returns true if this value is a function */
function IsFunction(value) {
  return IsEqual(typeof value, 'function');
}
/** Returns true if this value is integer */
function IsInteger(value) {
  return Number.isInteger(value);
}
/** Returns true if this value is an iterator */
function IsIterator(value) {
  return IsObject(value) && Symbol.iterator in value;
}
/** Returns true if this value is null */
function IsNull(value) {
  return IsEqual(value, null);
}
/** Returns true if this value is number */
function IsNumber(value) {
  return Number.isFinite(value);
}
/** Returns true if this value is an object but not an array */
function IsObjectNotArray(value) {
  return IsObject(value) && !IsArray(value);
}
/** Returns true if this value is an object */
function IsObject(value) {
  return IsEqual(typeof value, 'object') && !IsNull(value);
}
/** Returns true if this value is string */
function IsString(value) {
  return IsEqual(typeof value, 'string');
}
/** Returns true if this value is symbol */
function IsSymbol(value) {
  return IsEqual(typeof value, 'symbol');
}
/** Returns true if this value is undefined */
function IsUndefined(value) {
  return IsEqual(value, undefined);
}
// --------------------------------------------------------------------------
// Relational
// --------------------------------------------------------------------------
function IsEqual(left, right) {
  return left === right;
}
function IsGreaterThan(left, right) {
  return left > right;
}
function IsLessThan(left, right) {
  return left < right;
}
function IsLessEqualThan(left, right) {
  return left <= right;
}
function IsGreaterEqualThan(left, right) {
  return left >= right;
}
// --------------------------------------------------------------------------
// MultipleOf
// --------------------------------------------------------------------------
function IsMultipleOf(dividend, divisor) {
  if (IsBigInt(dividend) || IsBigInt(divisor)) {
    return BigInt(dividend) % BigInt(divisor) === 0n;
  }
  const tolerance = 1e-10;
  if (!IsNumber(dividend))
  return true;
  if (IsInteger(dividend) && 1 / divisor % 1 === 0)
  return true;
  const mod = dividend % divisor;
  return Math.min(Math.abs(mod), Math.abs(mod - divisor)) < tolerance;
}
// ------------------------------------------------------------------
// IsClassInstance
// ------------------------------------------------------------------
/** Returns true if the value appears to be an instance of a class. */
function IsClassInstance(value) {
  if (!IsObject(value))
  return false;
  const proto = globalThis.Object.getPrototypeOf(value);
  if (IsNull(proto))
  return false;
  return IsEqual(typeof proto.constructor, 'function') &&
  !(IsEqual(proto.constructor, globalThis.Object) ||
  IsEqual(proto.constructor.name, 'Object'));
}
// ------------------------------------------------------------------
// IsValueLike
// ------------------------------------------------------------------
function IsValueLike(value) {
  return IsBigInt(value) ||
  IsBoolean(value) ||
  IsNull(value) ||
  IsNumber(value) ||
  IsString(value) ||
  IsUndefined(value);
}
// --------------------------------------------------------------------------
// String
// --------------------------------------------------------------------------
/** Returns the number of grapheme clusters in the string */
function GraphemeCount(value) {
  return String.GraphemeCount(value);
}
/** Returns true if the string has at most the given number of graphemes */
function IsMaxLength(value, length) {
  return String.IsMaxLengthFast(value, length);
}
/** Returns true if the string has at least the given number of graphemes */
function IsMinLength(value, length) {
  return String.IsMinLengthFast(value, length);
}
// --------------------------------------------------------------------------
// Array
// --------------------------------------------------------------------------
/** Returns true if all elements from offset satisfy the callback, short-circuiting on the first failure */
function Every(value, offset, callback) {
  for (let index = offset; index < value.length; index++) {
    if (!callback(value[index], index))
    return false;
  }
  return true;
}
/** Returns true if all elements from offset satisfy the callback, visiting every element regardless of failure */
function EveryAll(value, offset, callback) {
  let result = true;
  for (let index = offset; index < value.length; index++) {
    if (!callback(value[index], index))
    result = false;
  }
  return result;
}
/** Takes the left-most element from an array and dispatches to the true arm, or the false arm if empty */
function TakeLeft(array, true_, false_) {
  return IsEqual(array.length, 0) ? false_() : true_(array[0], array.slice(1));
}
// --------------------------------------------------------------------------
// Object
// --------------------------------------------------------------------------
/** Returns true if the PropertyKey is Unsafe (ref: prototype-pollution). */
function IsUnsafePropertyKey(key) {
  return IsEqual(key, '__proto__') || IsEqual(key, 'constructor') || IsEqual(key, 'prototype');
}
/** Returns true if this value has this property key */
function HasPropertyKey(value, key) {
  return IsUnsafePropertyKey(key) ? Object.prototype.hasOwnProperty.call(value, key) : key in value;
}
/** Returns object entries as `[RegExp, Value][]` */
function EntriesRegExp(value) {
  return Keys(value).map((key) => [new RegExp(`^${key}$`), value[key]]);
}
/** Returns object entries as `[string, Value][]` */
function Entries(value) {
  return Object.entries(value);
}
/** Returns property keys for this object via `Object.getOwnPropertyKeys({ ... })` */
function Keys(value) {
  return Object.getOwnPropertyNames(value);
}
/** Returns the property keys for this object via `Object.getOwnPropertyKeys({ ... })` */
function Symbols(value) {
  return Object.getOwnPropertySymbols(value);
}
/** Returns the property values for the given object via `Object.values()` */
function Values(value) {
  return Object.values(value);
}
// ------------------------------------------------------------------
// IsDeepEqual
// ------------------------------------------------------------------
function DeepEqualObject(left, right) {
  if (!IsObject(right))
  return false;
  const keys = Keys(left);
  return IsEqual(keys.length, Keys(right).length) &&
  keys.every((key) => IsDeepEqual(left[key], right[key]));
}
function DeepEqualArray(left, right) {
  return IsArray(right) && IsEqual(left.length, right.length) &&
  left.every((_, index) => IsDeepEqual(left[index], right[index]));
}
/** Tests values for deep equality */
function IsDeepEqual(left, right) {
  return IsArray(left) ? DeepEqualArray(left, right) : IsObject(left) ? DeepEqualObject(left, right) : IsEqual(left, right);
} /* v9-455e4bc1e7b78ed0 */
