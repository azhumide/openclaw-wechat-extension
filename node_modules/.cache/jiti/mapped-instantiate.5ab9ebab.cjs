"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.MappedAction = MappedAction;exports.MappedInstantiate = MappedInstantiate;
var _index = require("../../../system/memory/index.mjs");
var _mapped = require("../../action/mapped.mjs");
var _instantiate = require("../instantiate.mjs");
var _mapped_operation = require("./mapped_operation.mjs"); // deno-fmt-ignore-file
function MappedAction(context, state, identifier, type, as, property, options) {
  const result = (0, _instantiate.CanInstantiate)([type]) ?
  _index.Memory.Update((0, _mapped_operation.MappedOperation)(context, state, identifier, type, as, property), {}, options) :
  (0, _mapped.MappedDeferred)(identifier, type, as, property, options);
  return result;
}
function MappedInstantiate(context, state, identifier, type, as, property, options) {
  const instantiatedType = (0, _instantiate.InstantiateType)(context, state, type);
  return MappedAction(context, state, identifier, instantiatedType, as, property, options);
} /* v9-f43efa2308e00f40 */
