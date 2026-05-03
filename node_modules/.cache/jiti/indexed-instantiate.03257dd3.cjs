"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IndexAction = IndexAction;exports.IndexInstantiate = IndexInstantiate;
var _index = require("../../../system/memory/index.mjs");
var _cyclic = require("../../types/cyclic.mjs");
var _intersect = require("../../types/intersect.mjs");
var _union = require("../../types/union.mjs");
var _instantiate = require("../instantiate.mjs");
var _indexed = require("../../action/indexed.mjs");
var _index2 = require("../object/index.mjs");
var _from_type = require("./from_type.mjs"); // deno-fmt-ignore-file
function NormalizeType(type) {
  const result = (0, _cyclic.IsCyclic)(type) || (0, _intersect.IsIntersect)(type) || (0, _union.IsUnion)(type) ? (0, _index2.CollapseToObject)(type) :
  type;
  return result;
}
function IndexAction(type, indexer, options) {
  const result = (0, _instantiate.CanInstantiate)([type, indexer]) ?
  _index.Memory.Update((0, _from_type.FromType)(NormalizeType(type), indexer), {}, options) :
  (0, _indexed.IndexDeferred)(type, indexer, options);
  return result;
}
function IndexInstantiate(context, state, type, indexer, options) {
  const instantiatedType = (0, _instantiate.InstantiateType)(context, state, type);
  const instantiatedIndexer = (0, _instantiate.InstantiateType)(context, state, indexer);
  return IndexAction(instantiatedType, instantiatedIndexer, options);
} /* v9-472beddb4c450d29 */
