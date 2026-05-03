"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FunctionOptions = FunctionOptions;exports.IsFunction = IsFunction;exports.Function = exports._Function_ = _Function_;
var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a Function type. */
function _Function_(parameters, returnType, options = {}) {
  return _index.Memory.Create({ ['~kind']: 'Function' }, { type: 'function', parameters, returnType }, options);
}
// Prevent Collision With Global Scope
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is TFunction. */
function IsFunction(value) {
  return (0, _schema.IsKind)(value, 'Function');
}
// ------------------------------------------------------------------
// Options
// ------------------------------------------------------------------
/** Extracts options from a TFunction. */
function FunctionOptions(type) {
  return _index.Memory.Discard(type, ['~kind', 'type', 'parameters', 'returnType']);
} /* v9-480e966ac71c1ebb */
