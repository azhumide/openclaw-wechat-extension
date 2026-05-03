"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.PickAction = PickAction;exports.PickInstantiate = PickInstantiate;
var _index = require("../../../system/memory/index.mjs");
var _pick = require("../../action/pick.mjs");
var _instantiate = require("../instantiate.mjs");
var _from_type = require("./from_type.mjs"); // deno-fmt-ignore-file
function PickAction(type, indexer, options) {
  const result = (0, _instantiate.CanInstantiate)([type, indexer]) ?
  _index.Memory.Update((0, _from_type.FromType)(type, indexer), {}, options) :
  (0, _pick.PickDeferred)(type, indexer, options);
  return result;
}
function PickInstantiate(context, state, type, indexer, options) {
  const instantiatedType = (0, _instantiate.InstantiateType)(context, state, type);
  const instantiatedIndexer = (0, _instantiate.InstantiateType)(context, state, indexer);
  return PickAction(instantiatedType, instantiatedIndexer, options);
} /* v9-b594ac3a6182f2d6 */
