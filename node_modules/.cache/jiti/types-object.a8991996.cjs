"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsObject = IsObject;exports.ObjectOptions = ObjectOptions;exports.Object = exports._Object_ = _Object_;
var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs");
var _properties = require("./properties.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates an Object type. */
function _Object_(properties, options = {}) {
  const requiredKeys = (0, _properties.RequiredArray)(properties);
  const required = requiredKeys.length > 0 ? { required: requiredKeys } : {};
  return _index.Memory.Create({ '~kind': 'Object' }, { type: 'object', ...required, properties }, options);
}
// Prevent Collision With Global Scope
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is TObject. */
function IsObject(value) {
  return (0, _schema.IsKind)(value, 'Object');
}
// ------------------------------------------------------------------
// Options
// ------------------------------------------------------------------
/** Extracts options from a TObject. */
function ObjectOptions(type) {
  return _index.Memory.Discard(type, ['~kind', 'type', 'properties', 'required']);
} /* v9-c50d36e23bb9cd4c */
