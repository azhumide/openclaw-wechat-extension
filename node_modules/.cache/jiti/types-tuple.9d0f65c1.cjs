"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsTuple = IsTuple;exports.Tuple = Tuple;exports.TupleOptions = TupleOptions;
var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a Tuple type. */
function Tuple(types, options = {}) {
  const [items, minItems, additionalItems] = [types, types.length, false];
  return _index.Memory.Create({ ['~kind']: 'Tuple' }, { type: 'array', additionalItems, items, minItems }, options);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is TTuple. */
function IsTuple(value) {
  return (0, _schema.IsKind)(value, 'Tuple');
}
// ------------------------------------------------------------------
// Options
// ------------------------------------------------------------------
/** Extracts options from a TTuple. */
function TupleOptions(type) {
  return _index.Memory.Discard(type, ['~kind', 'type', 'items', 'minItems', 'additionalItems']);
} /* v9-c0ef9b90b70d612f */
