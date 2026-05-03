"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsUnsafe = IsUnsafe;exports.Unsafe = Unsafe;

var _index = require("../../guard/index.mjs");
var _index2 = require("../../system/memory/index.mjs"); // deno-fmt-ignore-file
// deno-lint-ignore-file 
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a Unsafe type. */function Unsafe(schema) {
  return _index2.Memory.Update(schema, { ['~unsafe']: null }, {});
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is TUnsafe. */
function IsUnsafe(value) {
  return _index.Guard.IsObjectNotArray(value) &&
  _index.Guard.HasPropertyKey(value, '~unsafe') &&
  _index.Guard.IsNull(value['~unsafe']);
} /* v9-a2f4c7d7534e1f6d */
