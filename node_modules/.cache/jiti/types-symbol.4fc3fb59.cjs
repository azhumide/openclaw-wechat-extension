"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsSymbol = IsSymbol;exports.Symbol = Symbol;
var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a Symbol type. */
function Symbol(options) {
  return _index.Memory.Create({ '~kind': 'Symbol' }, { type: 'symbol' }, options);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is TSymbol. */
function IsSymbol(value) {
  return (0, _schema.IsKind)(value, 'Symbol');
} /* v9-4be30e81411f1fb1 */
