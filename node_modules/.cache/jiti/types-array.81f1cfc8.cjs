"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ArrayOptions = ArrayOptions;exports.IsArray = IsArray;exports.Array = exports._Array_ = _Array_;
var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates an Array type. */
function _Array_(items, options) {
  return _index.Memory.Create({ '~kind': 'Array' }, { type: 'array', items }, options);
}
// Prevent Collision With Global Scope
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is a TArray. */
function IsArray(value) {
  return (0, _schema.IsKind)(value, 'Array');
}
// ------------------------------------------------------------------
// Options
// ------------------------------------------------------------------
/** Extracts options from a TArray. */
function ArrayOptions(type) {
  return _index.Memory.Discard(type, ['~kind', 'type', 'items']);
} /* v9-b1783b8743f825af */
