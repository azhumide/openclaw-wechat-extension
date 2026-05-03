"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsIterator = IsIterator;exports.Iterator = Iterator;exports.IteratorOptions = IteratorOptions;
var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/**
 * Creates a Iterator type.
 *
 * @deprecated This type is being removed in the next version of TypeBox. A fallback will be provided under examples.
 */
function Iterator(iteratorItems, options) {
  return _index.Memory.Create({ '~kind': 'Iterator' }, { type: 'iterator', iteratorItems }, options);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is TIterator. */
function IsIterator(value) {
  return (0, _schema.IsKind)(value, 'Iterator');
}
// ------------------------------------------------------------------
// Options
// ------------------------------------------------------------------
/** Extracts options from a TIterator. */
function IteratorOptions(type) {
  return _index.Memory.Discard(type, ['~kind', 'type', 'iteratorItems']);
} /* v9-94ae5ed6d5b2ff45 */
