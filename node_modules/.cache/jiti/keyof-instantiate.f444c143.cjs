"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.KeyOfAction = KeyOfAction;exports.KeyOfInstantiate = KeyOfInstantiate;
var _index = require("../../../system/memory/index.mjs");
var _cyclic = require("../../types/cyclic.mjs");
var _intersect = require("../../types/intersect.mjs");
var _union = require("../../types/union.mjs");
var _keyof = require("../../action/keyof.mjs");
var _instantiate = require("../instantiate.mjs");
var _index2 = require("../object/index.mjs");



var _from_type = require("./from_type.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Computed
// ------------------------------------------------------------------
function NormalizeType(type) {const result = (0, _cyclic.IsCyclic)(type) || (0, _intersect.IsIntersect)(type) || (0, _union.IsUnion)(type) ? (0, _index2.CollapseToObject)(type) : type;return result;}
function KeyOfAction(type, options) {
  return (0, _instantiate.CanInstantiate)([type]) ?
  _index.Memory.Update((0, _from_type.FromType)(NormalizeType(type)), {}, options) :
  (0, _keyof.KeyOfDeferred)(type, options);
}
function KeyOfInstantiate(context, state, type, options) {
  const instantiatedType = (0, _instantiate.InstantiateType)(context, state, type);
  return KeyOfAction(instantiatedType, options);
} /* v9-eba507e37afa583e */
