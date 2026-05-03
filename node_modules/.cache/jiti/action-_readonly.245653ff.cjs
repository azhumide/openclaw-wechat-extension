"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsReadonlyAddAction = IsReadonlyAddAction;exports.IsReadonlyRemoveAction = IsReadonlyRemoveAction;exports.ReadonlyAddAction = ReadonlyAddAction;exports.ReadonlyRemoveAction = ReadonlyRemoveAction;
var _index = require("../../system/memory/index.mjs");
var _index2 = require("../../guard/index.mjs");
var _schema = require("../types/schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Action
// ------------------------------------------------------------------
/** Creates a ReadonlyAddAction. */
function ReadonlyAddAction(type) {
  return _index.Memory.Create({ ['~kind']: 'ReadonlyAddAction' }, { type }, {});
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if this value is a ReadonlyAddAction. */
function IsReadonlyAddAction(value) {
  return _index2.Guard.IsObject(value) &&
  _index2.Guard.HasPropertyKey(value, '~kind') &&
  _index2.Guard.HasPropertyKey(value, 'type') &&
  _index2.Guard.IsEqual(value['~kind'], 'ReadonlyAddAction') &&
  (0, _schema.IsSchema)(value.type);
}
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a ReadonlyRemoveAction. */
function ReadonlyRemoveAction(type) {
  return _index.Memory.Create({ ['~kind']: 'ReadonlyRemoveAction' }, { type }, {});
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if this value is a ReadonlyRemoveAction. */
function IsReadonlyRemoveAction(value) {
  return _index2.Guard.IsObject(value) &&
  _index2.Guard.HasPropertyKey(value, '~kind') &&
  _index2.Guard.HasPropertyKey(value, 'type') &&
  _index2.Guard.IsEqual(value['~kind'], 'ReadonlyRemoveAction') &&
  (0, _schema.IsSchema)(value.type);
} /* v9-c111a2c9623e55c8 */
