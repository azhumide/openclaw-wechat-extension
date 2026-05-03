"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ReturnTypeAction = ReturnTypeAction;exports.ReturnTypeInstantiate = ReturnTypeInstantiate;
var _index = require("../../../system/memory/index.mjs");
var _function = require("../../types/function.mjs");
var _never = require("../../types/never.mjs");
var _return_type = require("../../action/return_type.mjs");
var _instantiate = require("../instantiate.mjs"); // deno-fmt-ignore-file
function ReturnTypeOperation(type) {
  return (0, _function.IsFunction)(type) ?
  type['returnType'] :
  (0, _never.Never)();
}
function ReturnTypeAction(type, options) {
  const result = (0, _instantiate.CanInstantiate)([type]) ?
  _index.Memory.Update(ReturnTypeOperation(type), {}, options) :
  (0, _return_type.ReturnTypeDeferred)(type, options);
  return result;
}
function ReturnTypeInstantiate(context, state, type, options = {}) {
  const instantiatedType = (0, _instantiate.InstantiateType)(context, state, type);
  return ReturnTypeAction(instantiatedType, options);
} /* v9-8090d3d2773ec0f7 */
