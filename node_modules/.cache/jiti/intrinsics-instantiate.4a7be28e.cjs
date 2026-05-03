"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.CapitalizeAction = CapitalizeAction;exports.CapitalizeInstantiate = CapitalizeInstantiate;exports.LowercaseAction = LowercaseAction;exports.LowercaseInstantiate = LowercaseInstantiate;exports.UncapitalizeAction = UncapitalizeAction;exports.UncapitalizeInstantiate = UncapitalizeInstantiate;exports.UppercaseAction = UppercaseAction;exports.UppercaseInstantiate = UppercaseInstantiate;
var _index = require("../../../system/memory/index.mjs");
var _from_type = require("./from_type.mjs");
var _instantiate = require("../instantiate.mjs");
var _capitalize = require("../../action/capitalize.mjs");
var _lowercase = require("../../action/lowercase.mjs");
var _uncapitalize = require("../../action/uncapitalize.mjs");
var _uppercase = require("../../action/uppercase.mjs"); // deno-fmt-ignore-file
const CapitalizeMapping = (input) => input[0].toUpperCase() + input.slice(1);
const LowercaseMapping = (input) => input.toLowerCase();
const UncapitalizeMapping = (input) => input[0].toLowerCase() + input.slice(1);
const UppercaseMapping = (input) => input.toUpperCase();
function CapitalizeAction(type, options) {
  const result = (0, _instantiate.CanInstantiate)([type]) ?
  _index.Memory.Update((0, _from_type.FromType)(CapitalizeMapping, type), {}, options) :
  (0, _capitalize.CapitalizeDeferred)(type, options);
  return result;
}
function LowercaseAction(type, options) {
  const result = (0, _instantiate.CanInstantiate)([type]) ?
  _index.Memory.Update((0, _from_type.FromType)(LowercaseMapping, type), {}, options) :
  (0, _lowercase.LowercaseDeferred)(type, options);
  return result;
}
function UncapitalizeAction(type, options) {
  const result = (0, _instantiate.CanInstantiate)([type]) ?
  _index.Memory.Update((0, _from_type.FromType)(UncapitalizeMapping, type), {}, options) :
  (0, _uncapitalize.UncapitalizeDeferred)(type, options);
  return result;
}
function UppercaseAction(type, options) {
  const result = (0, _instantiate.CanInstantiate)([type]) ?
  _index.Memory.Update((0, _from_type.FromType)(UppercaseMapping, type), {}, options) :
  (0, _uppercase.UppercaseDeferred)(type, options);
  return result;
}
function CapitalizeInstantiate(context, state, type, options) {
  const instantiatedType = (0, _instantiate.InstantiateType)(context, state, type);
  return CapitalizeAction(instantiatedType, options);
}
function LowercaseInstantiate(context, state, type, options) {
  const instantiatedType = (0, _instantiate.InstantiateType)(context, state, type);
  return LowercaseAction(instantiatedType, options);
}
function UncapitalizeInstantiate(context, state, type, options) {
  const instantiatedType = (0, _instantiate.InstantiateType)(context, state, type);
  return UncapitalizeAction(instantiatedType, options);
}
function UppercaseInstantiate(context, state, type, options) {
  const instantiatedType = (0, _instantiate.InstantiateType)(context, state, type);
  return UppercaseAction(instantiatedType, options);
} /* v9-4d3d39c2dadf28c3 */
