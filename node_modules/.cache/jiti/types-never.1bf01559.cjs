"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsNever = IsNever;exports.Never = Never;exports.NeverPattern = void 0;

var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-lint-ignore-file ban-types
// deno-fmt-ignore-file
// ------------------------------------------------------------------
// Pattern
// ------------------------------------------------------------------
const NeverPattern = exports.NeverPattern = '(?!)'; // ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a Never type. */
function Never(options) {
  return _index.Memory.Create({ '~kind': 'Never' }, { not: {} }, options);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is TNever. */
function IsNever(value) {
  return (0, _schema.IsKind)(value, 'Never');
} /* v9-38bb34bb4a291433 */
