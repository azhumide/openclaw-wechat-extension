"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.OmitAction = OmitAction;exports.OmitInstantiate = OmitInstantiate;
var _index = require("../../../system/memory/index.mjs");
var _omit = require("../../action/omit.mjs");
var _instantiate = require("../instantiate.mjs");
var _from_type = require("./from_type.mjs"); // deno-fmt-ignore-file
function OmitAction(type, indexer, options) {
  const result = (0, _instantiate.CanInstantiate)([type, indexer]) ?
  _index.Memory.Update((0, _from_type.FromType)(type, indexer), {}, options) :
  (0, _omit.OmitDeferred)(type, indexer, options);
  return result;
}
function OmitInstantiate(context, state, type, indexer, options) {
  const instantiatedType = (0, _instantiate.InstantiateType)(context, state, type);
  const instantiatedIndexer = (0, _instantiate.InstantiateType)(context, state, indexer);
  return OmitAction(instantiatedType, instantiatedIndexer, options);
} /* v9-d76b124fc844cd3d */
