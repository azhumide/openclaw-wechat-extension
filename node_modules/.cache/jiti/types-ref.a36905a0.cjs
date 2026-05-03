"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsRef = IsRef;exports.Ref = Ref;

var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-lint-ignore-file no-explicit-any
// deno-fmt-ignore-file
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a Ref type. */function Ref(ref, options) {
  return _index.Memory.Create({ ['~kind']: 'Ref' }, { $ref: ref }, options);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is TRef. */
function IsRef(value) {
  return (0, _schema.IsKind)(value, 'Ref');
} /* v9-acb380ef8586e313 */
