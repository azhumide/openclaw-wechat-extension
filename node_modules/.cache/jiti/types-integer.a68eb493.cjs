"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Integer = Integer;exports.IntegerPattern = void 0;exports.IsInteger = IsInteger;
var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Pattern
// ------------------------------------------------------------------
const IntegerPattern = exports.IntegerPattern = '-?(?:0|[1-9][0-9]*)';
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a Integer type. */
function Integer(options) {
  return _index.Memory.Create({ '~kind': 'Integer' }, { type: 'integer' }, options);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is TInteger. */
function IsInteger(value) {
  return (0, _schema.IsKind)(value, 'Integer');
} /* v9-2ba7d70a200d5ad0 */
