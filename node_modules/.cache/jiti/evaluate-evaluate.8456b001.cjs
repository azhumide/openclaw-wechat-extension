"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.EvaluateIntersect = EvaluateIntersect;exports.EvaluateType = EvaluateType;exports.EvaluateUnion = EvaluateUnion;exports.EvaluateUnionFast = EvaluateUnionFast;
var _index = require("../../../guard/index.mjs");
var _intersect = require("../../types/intersect.mjs");
var _distribute = require("./distribute.mjs");
var _broaden = require("./broaden.mjs");
var _union = require("../../types/union.mjs");
var _never = require("../../types/never.mjs"); // deno-fmt-ignore-file
function EvaluateIntersect(types) {
  const distribution = (0, _distribute.Distribute)(types);
  const result = (0, _broaden.Broaden)(distribution);
  return result;
}
function EvaluateUnion(types) {
  const result = (0, _broaden.Broaden)(types);
  return result;
}
function EvaluateType(type) {
  return (0, _intersect.IsIntersect)(type) ? EvaluateIntersect(type.allOf) :
  (0, _union.IsUnion)(type) ? EvaluateUnion(type.anyOf) :
  type;
}
function EvaluateUnionFast(types) {
  const result = _index.Guard.IsEqual(types.length, 1) ? types[0] :
  _index.Guard.IsEqual(types.length, 0) ? (0, _never.Never)() :
  (0, _union.Union)(types);
  return result;
} /* v9-77e5c7eea7de23d0 */
