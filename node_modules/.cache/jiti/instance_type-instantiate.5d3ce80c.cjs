"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.InstanceTypeAction = InstanceTypeAction;exports.InstanceTypeInstantiate = InstanceTypeInstantiate;
var _index = require("../../../system/memory/index.mjs");
var _constructor = require("../../types/constructor.mjs");
var _never = require("../../types/never.mjs");
var _instance_type = require("../../action/instance_type.mjs");
var _instantiate = require("../instantiate.mjs"); // deno-fmt-ignore-file
function InstanceTypeOperation(type) {
  return (0, _constructor.IsConstructor)(type) ?
  type['instanceType'] :
  (0, _never.Never)();
}
function InstanceTypeAction(type, options) {
  const result = (0, _instantiate.CanInstantiate)([type]) ?
  _index.Memory.Update(InstanceTypeOperation(type), {}, options) :
  (0, _instance_type.InstanceTypeDeferred)(type, options);
  return result;
}
function InstanceTypeInstantiate(context, state, type, options = {}) {
  const instantiatedType = (0, _instantiate.InstantiateType)(context, state, type);
  return InstanceTypeAction(instantiatedType, options);
} /* v9-207136500ac2dd44 */
