"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsOptionalAddAction = IsOptionalAddAction;exports.IsOptionalRemoveAction = IsOptionalRemoveAction;exports.OptionalAddAction = OptionalAddAction;exports.OptionalRemoveAction = OptionalRemoveAction;
var _index = require("../../system/memory/index.mjs");
var _index2 = require("../../guard/index.mjs");
var _schema = require("../types/schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Action
// ------------------------------------------------------------------
/** Creates an OptionalAddAction. */
function OptionalAddAction(type) {
  return _index.Memory.Create({ ['~kind']: 'OptionalAddAction' }, { type }, {});
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if this value is a OptionalAddAction. */
function IsOptionalAddAction(value) {
  return _index2.Guard.IsObject(value) &&
  _index2.Guard.HasPropertyKey(value, '~kind') &&
  _index2.Guard.HasPropertyKey(value, 'type') &&
  _index2.Guard.IsEqual(value['~kind'], 'OptionalAddAction') &&
  (0, _schema.IsSchema)(value.type);
}
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a OptionalRemoveAction. */
function OptionalRemoveAction(type) {
  return _index.Memory.Create({ ['~kind']: 'OptionalRemoveAction' }, { type }, {});
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if this value is a OptionalRemoveAction. */
function IsOptionalRemoveAction(value) {
  return _index2.Guard.IsObject(value) &&
  _index2.Guard.HasPropertyKey(value, '~kind') &&
  _index2.Guard.HasPropertyKey(value, 'type') &&
  _index2.Guard.IsEqual(value['~kind'], 'OptionalRemoveAction') &&
  (0, _schema.IsSchema)(value.type);
} /* v9-636c747c26184ccd */
