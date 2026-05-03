"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsBigInt64Array = IsBigInt64Array;exports.IsBigUint64Array = IsBigUint64Array;exports.IsBoolean = IsBoolean;exports.IsDate = IsDate;exports.IsFloat32Array = IsFloat32Array;exports.IsFloat64Array = IsFloat64Array;exports.IsInt16Array = IsInt16Array;exports.IsInt32Array = IsInt32Array;exports.IsInt8Array = IsInt8Array;exports.IsMap = IsMap;exports.IsNumber = IsNumber;exports.IsRegExp = IsRegExp;exports.IsSet = IsSet;exports.IsString = IsString;exports.IsTypeArray = IsTypeArray;exports.IsUint16Array = IsUint16Array;exports.IsUint32Array = IsUint32Array;exports.IsUint8Array = IsUint8Array;exports.IsUint8ClampedArray = IsUint8ClampedArray; // --------------------------------------------------------------------------
// Primitives
// --------------------------------------------------------------------------
function IsBoolean(value) {
  return value instanceof Boolean;
}
function IsNumber(value) {
  return value instanceof Number;
}
function IsString(value) {
  return value instanceof String;
}
// --------------------------------------------------------------------------
// TypeArray
// --------------------------------------------------------------------------
function IsTypeArray(value) {
  return globalThis.ArrayBuffer.isView(value);
}
/** Returns true if the value is a Int8Array */
function IsInt8Array(value) {
  return value instanceof globalThis.Int8Array;
}
/** Returns true if the value is a Uint8Array */
function IsUint8Array(value) {
  return value instanceof globalThis.Uint8Array;
}
/** Returns true if the value is a Uint8ClampedArray */
function IsUint8ClampedArray(value) {
  return value instanceof globalThis.Uint8ClampedArray;
}
/** Returns true if the value is a Int16Array */
function IsInt16Array(value) {
  return value instanceof globalThis.Int16Array;
}
/** Returns true if the value is a Uint16Array */
function IsUint16Array(value) {
  return value instanceof globalThis.Uint16Array;
}
/** Returns true if the value is a Int32Array */
function IsInt32Array(value) {
  return value instanceof globalThis.Int32Array;
}
/** Returns true if the value is a Uint32Array */
function IsUint32Array(value) {
  return value instanceof globalThis.Uint32Array;
}
/** Returns true if the value is a Float32Array */
function IsFloat32Array(value) {
  return value instanceof globalThis.Float32Array;
}
/** Returns true if the value is a Float64Array */
function IsFloat64Array(value) {
  return value instanceof globalThis.Float64Array;
}
/** Returns true if the value is a BigInt64Array */
function IsBigInt64Array(value) {
  return value instanceof globalThis.BigInt64Array;
}
/** Returns true if the value is a BigUint64Array */
function IsBigUint64Array(value) {
  return value instanceof globalThis.BigUint64Array;
}
// ------------------------------------------------------------------
// RegExp
// ------------------------------------------------------------------
/** Returns true if the value is a RegExp */
function IsRegExp(value) {
  return value instanceof globalThis.RegExp;
}
// ------------------------------------------------------------------
// Date
// ------------------------------------------------------------------
/** Returns true if the value is a Date */
function IsDate(value) {
  return value instanceof globalThis.Date;
}
// ------------------------------------------------------------------
// Set
// ------------------------------------------------------------------
/** Returns true if the value is a Set */
function IsSet(value) {
  return value instanceof globalThis.Set;
}
// ------------------------------------------------------------------
// Map
// ------------------------------------------------------------------
/** Returns true if the value is a Map */
function IsMap(value) {
  return value instanceof globalThis.Map;
} /* v9-d00431166022c654 */
