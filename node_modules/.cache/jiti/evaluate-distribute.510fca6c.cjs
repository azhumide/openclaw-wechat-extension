"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Distribute = Distribute;

var _index = require("../../../guard/index.mjs");
var _union = require("../../types/union.mjs");
var _object = require("../../types/object.mjs");
var _tuple = require("../../types/tuple.mjs");
var _composite = require("./composite.mjs");
var _narrow = require("./narrow.mjs");
var _evaluate = require("./evaluate.mjs"); // deno-fmt-ignore-file
// deno-fmt-ignore-file
function IsObjectLike(type) {
  return (0, _object.IsObject)(type) || (0, _tuple.IsTuple)(type);
}
function IsUnionOperand(left, right) {
  const isUnionLeft = (0, _union.IsUnion)(left);
  const isUnionRight = (0, _union.IsUnion)(right);
  const result = isUnionLeft || isUnionRight;
  return result;
}
function DistributeOperation(left, right) {
  const evaluatedLeft = (0, _evaluate.EvaluateType)(left);
  const evaluatedRight = (0, _evaluate.EvaluateType)(right);
  const isUnionOperand = IsUnionOperand(evaluatedLeft, evaluatedRight);
  const isObjectLeft = IsObjectLike(evaluatedLeft);
  const IsObjectRight = IsObjectLike(evaluatedRight);
  const result = isUnionOperand ? (0, _evaluate.EvaluateIntersect)([evaluatedLeft, evaluatedRight]) :
  isObjectLeft && IsObjectRight ? (0, _composite.Composite)(evaluatedLeft, evaluatedRight) :
  isObjectLeft && !IsObjectRight ? evaluatedLeft :
  !isObjectLeft && IsObjectRight ? evaluatedRight :
  (0, _narrow.Narrow)(evaluatedLeft, evaluatedRight);
  return result;
}
function DistributeType(type, types, result = []) {
  return _index.Guard.TakeLeft(types, (left, right) => DistributeType(type, right, [...result, DistributeOperation(type, left)]), () => _index.Guard.IsEqual(result.length, 0) ?
  [type] :
  result);
}
function DistributeUnion(types, distribution, result = []) {
  return _index.Guard.TakeLeft(types, (left, right) => DistributeUnion(right, distribution, [...result, ...Distribute([left], distribution)]), () => result);
}
function Distribute(types, result = []) {
  return _index.Guard.TakeLeft(types, (left, right) => (0, _union.IsUnion)(left) ?
  Distribute(right, DistributeUnion(left.anyOf, result)) :
  Distribute(right, DistributeType(left, result)), () => result);
} /* v9-423a2160f7efa9ff */
