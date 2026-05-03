"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Immutable = Immutable;exports.ImmutableAdd = ImmutableAdd;exports.ImmutableRemove = ImmutableRemove;exports.IsImmutable = IsImmutable;
var _index = require("../../system/memory/index.mjs");
var _index2 = require("../../guard/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
/** Removes Immutable from the given type. */
function ImmutableRemove(type) {
  return _index.Memory.Discard(type, ['~immutable']);
}
/** Adds Immutable to the given type. */
function ImmutableAdd(type) {
  return _index.Memory.Update(type, { '~immutable': true }, {});
}
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Applies an Immutable modifier to the given type. */
function Immutable(type) {
  return ImmutableAdd(type);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is a TImmutable */
function IsImmutable(value) {
  return (0, _schema.IsSchema)(value) && _index2.Guard.HasPropertyKey(value, '~immutable');
} /* v9-75b4c7054d482a5c */
