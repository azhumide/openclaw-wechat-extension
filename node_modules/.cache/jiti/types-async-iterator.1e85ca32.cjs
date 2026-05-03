"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.AsyncIterator = AsyncIterator;exports.AsyncIteratorOptions = AsyncIteratorOptions;exports.IsAsyncIterator = IsAsyncIterator;
var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/**
 * Creates a AsyncIterator type.
 *
 * @deprecated This type is being removed in the next version of TypeBox. A fallback will be provided under examples.
 */
function AsyncIterator(iteratorItems, options) {
  return _index.Memory.Create({ '~kind': 'AsyncIterator' }, { type: 'asyncIterator', iteratorItems }, options);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is a TAsyncIterator */
function IsAsyncIterator(value) {
  return (0, _schema.IsKind)(value, 'AsyncIterator');
}
// ------------------------------------------------------------------
// Options
// ------------------------------------------------------------------
/** Extracts options from a TAsyncIterator. */
function AsyncIteratorOptions(type) {
  return _index.Memory.Discard(type, ['~kind', 'type', 'iteratorItems']);
} /* v9-6a51aa1bc894f62d */
