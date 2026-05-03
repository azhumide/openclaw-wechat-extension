"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ConditionalAction = ConditionalAction;exports.ConditionalInstantiate = ConditionalInstantiate;
var _index = require("../../../system/memory/index.mjs");
var _union = require("../../types/union.mjs");
var _index2 = require("../../extends/index.mjs");
var _instantiate = require("../instantiate.mjs");
var _conditional = require("../../action/conditional.mjs"); // deno-fmt-ignore-file
function ConditionalOperation(context, state, left, right, true_, false_) {
  const extendsResult = (0, _index2.Extends)(context, left, right);
  return _index2.ExtendsResult.IsExtendsUnion(extendsResult) ? (0, _union.Union)([(0, _instantiate.InstantiateType)(extendsResult.inferred, state, true_), (0, _instantiate.InstantiateType)(context, state, false_)]) :
  _index2.ExtendsResult.IsExtendsTrue(extendsResult) ? (0, _instantiate.InstantiateType)(extendsResult.inferred, state, true_) :
  (0, _instantiate.InstantiateType)(context, state, false_);
}
function ConditionalAction(context, state, left, right, true_, false_, options) {
  const result = (0, _instantiate.CanInstantiate)([left, right]) ?
  _index.Memory.Update(ConditionalOperation(context, state, left, right, true_, false_), {}, options) :
  (0, _conditional.ConditionalDeferred)(left, right, true_, false_, options);
  return result;
}
function ConditionalInstantiate(context, state, left, right, true_, false_, options) {
  const instantiatedLeft = (0, _instantiate.InstantiateType)(context, state, left);
  const instantiatedRight = (0, _instantiate.InstantiateType)(context, state, right);
  return ConditionalAction(context, state, instantiatedLeft, instantiatedRight, true_, false_, options);
} /* v9-a38c1420da640ef0 */
