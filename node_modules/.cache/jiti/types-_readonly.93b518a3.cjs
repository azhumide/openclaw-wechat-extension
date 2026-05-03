"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsReadonly = IsReadonly;exports.Readonly = Readonly;exports.ReadonlyAdd = ReadonlyAdd;exports.ReadonlyRemove = ReadonlyRemove;
var _index = require("../../system/memory/index.mjs");
var _index2 = require("../../guard/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
/** Removes a Readonly property modifier from the given type. */
function ReadonlyRemove(type) {
  return _index.Memory.Discard(type, ['~readonly']);
}
/** Adds a Readonly property modifier to the given type. */
function ReadonlyAdd(type) {
  return _index.Memory.Update(type, { '~readonly': true }, {});
}
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Applies an Readonly property modifier to the given type. */
function Readonly(type) {
  return ReadonlyAdd(type);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is a TReadonly */
function IsReadonly(value) {
  return (0, _schema.IsSchema)(value) && _index2.Guard.HasPropertyKey(value, '~readonly');
} /* v9-7dcfbe5bd44a543b */
