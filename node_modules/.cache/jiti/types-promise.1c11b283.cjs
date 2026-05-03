"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsPromise = IsPromise;exports.PromiseOptions = PromiseOptions;exports.Promise = exports._Promise_ = _Promise_;
var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/**
 * Creates a Promise type.
 *
 * @deprecated This type is being removed in the next version of TypeBox. A fallback will be provided under examples.
 */
function _Promise_(item, options) {
  return _index.Memory.Create({ ['~kind']: 'Promise' }, { type: 'promise', item }, options);
}

// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given type is TPromise. */
function IsPromise(value) {
  return (0, _schema.IsKind)(value, 'Promise');
}
// ------------------------------------------------------------------
// Options
// ------------------------------------------------------------------
/** Extracts options from a TPromise. */
function PromiseOptions(type) {
  return _index.Memory.Discard(type, ['~kind', 'type', 'item']);
} /* v9-3e66eb5dae841a83 */
