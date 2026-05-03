"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.AwaitedAction = AwaitedAction;exports.AwaitedInstantiate = AwaitedInstantiate;
var _index = require("../../../system/memory/index.mjs");
var _promise = require("../../types/promise.mjs");
var _awaited = require("../../action/awaited.mjs");
var _instantiate = require("../instantiate.mjs"); // deno-fmt-ignore-file
function AwaitedOperation(type) {
  return (0, _promise.IsPromise)(type) ?
  AwaitedOperation(type.item) :
  type;
}
function AwaitedAction(type, options) {
  const result = (0, _instantiate.CanInstantiate)([type]) ?
  _index.Memory.Update(AwaitedOperation(type), {}, options) :
  (0, _awaited.AwaitedDeferred)(type, options);
  return result;
}
function AwaitedInstantiate(context, state, type, options) {
  const instantiatedType = (0, _instantiate.InstantiateType)(context, state, type);
  return AwaitedAction(instantiatedType, options);
} /* v9-3efa8e5e945bd89d */
