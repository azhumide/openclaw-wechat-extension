"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsKind = IsKind;exports.IsSchema = IsSchema;

var _index = require("../../guard/index.mjs"); // deno-lint-ignore-file
// deno-fmt-ignore-file
// ------------------------------------------------------------------
// Kind
// ------------------------------------------------------------------
function IsKind(value, kind) {return _index.Guard.IsObject(value) && _index.Guard.HasPropertyKey(value, '~kind') && _index.Guard.IsEqual(value["~kind"], kind);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
function IsSchema(value) {
  return _index.Guard.IsObject(value);
} /* v9-3975f39a30e0b4ab */
