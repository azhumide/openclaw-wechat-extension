"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsUnion = IsUnion;exports.Union = Union;exports.UnionOptions = UnionOptions;
var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a Union type. */
function Union(anyOf, options = {}) {
  return _index.Memory.Create({ '~kind': 'Union' }, { anyOf }, options);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is TUnion. */
function IsUnion(value) {
  return (0, _schema.IsKind)(value, 'Union');
}
// ------------------------------------------------------------------
// Options
// ------------------------------------------------------------------
/** Extracts options from a TUnion. */
function UnionOptions(type) {
  return _index.Memory.Discard(type, ['~kind', 'anyOf']);
} /* v9-60cd1527b4b3a5c3 */
