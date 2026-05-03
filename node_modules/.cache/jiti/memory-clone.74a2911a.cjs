"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Clone = Clone;
var _index = require("../../guard/index.mjs");
var _metrics = require("./metrics.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
function IsGuard(value) {
  return _index.Guard.IsObject(value) && _index.Guard.HasPropertyKey(value, '~guard');
}
function FromGuard(value) {
  return value; // non-clonable
}
// ------------------------------------------------------------------
// Array
// ------------------------------------------------------------------
function FromArray(value) {
  return value.map((value) => FromValue(value));
}
// ------------------------------------------------------------------
// Object
// ------------------------------------------------------------------
function FromObject(value) {
  const result = {};
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of Object.keys(descriptors)) {
    const descriptor = descriptors[key];
    if (_index.Guard.HasPropertyKey(descriptor, 'value')) {
      Object.defineProperty(result, key, { ...descriptor, value: FromValue(descriptor.value) });
    }
  }
  return result;
}
// ------------------------------------------------------------------
// RegExp
// ------------------------------------------------------------------
function FromRegExp(value) {
  return new RegExp(value.source, value.flags);
}
// ------------------------------------------------------------------
// RegExp
// ------------------------------------------------------------------
function FromUnknown(value) {
  return value;
}
// ------------------------------------------------------------------
// Value
// ------------------------------------------------------------------
function FromValue(value) {
  return value instanceof RegExp ? FromRegExp(value) :
  IsGuard(value) ? FromGuard(value) :
  _index.Guard.IsArray(value) ? FromArray(value) :
  _index.Guard.IsObject(value) ? FromObject(value) :
  FromUnknown(value);
}
/**
 * Clones a value using the TypeBox type cloning strategy. This function preserves non-enumerable
 * properties from the source value. This is to ensure cloned types retain discriminable
 * hidden properties.
 */
function Clone(value) {
  _metrics.Metrics.clone += 1;
  return FromValue(value);
} /* v9-a7bd8aa7934e7d77 */
