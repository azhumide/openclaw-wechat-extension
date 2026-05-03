"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsOptional = IsOptional;exports.Optional = Optional;exports.OptionalAdd = OptionalAdd;exports.OptionalRemove = OptionalRemove;
var _index = require("../../guard/index.mjs");
var _index2 = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
/** Removes Optional from the given type. */
function OptionalRemove(type) {
  const result = _index2.Memory.Discard(type, ['~optional']);
  return result;
}
/** Adds Optional to the given type. */
function OptionalAdd(type) {
  return _index2.Memory.Update(type, { '~optional': true }, {});
}
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Applies an Optional modifier to the given type. */
function Optional(type) {
  return OptionalAdd(type);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is TOptional */
function IsOptional(value) {
  return (0, _schema.IsSchema)(value) && _index.Guard.HasPropertyKey(value, '~optional');
} /* v9-294e5a7c7e8c18d8 */
