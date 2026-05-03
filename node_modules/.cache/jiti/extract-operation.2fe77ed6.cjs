"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ExtractOperation = ExtractOperation;

var _enum = require("../../types/enum.mjs");
var _union = require("../../types/union.mjs");
var _index = require("../../extends/index.mjs");
var _index2 = require("../enum/index.mjs");
var _index3 = require("../evaluate/index.mjs"); // deno-lint-ignore-file ban-types
// deno-fmt-ignore-file
function ExtractUnionLeft(types, right) {return types.reduce((result, head) => {
    return [...result, ...ExtractTypeLeft(head, right)];
  }, []);
}
function ExtractTypeLeft(left, right) {
  const check = (0, _index.Extends)({}, left, right);
  const result = _index.ExtendsResult.IsExtendsTrueLike(check) ? [left] : [];
  return result;
}
function ExtractOperation(left, right) {
  const remaining = (0, _enum.IsEnum)(left) ? ExtractUnionLeft((0, _index2.EnumValuesToVariants)(left.enum), right) :
  (0, _union.IsUnion)(left) ? ExtractUnionLeft((0, _index3.Flatten)(left.anyOf), right) :
  ExtractTypeLeft(left, right);
  const result = (0, _index3.EvaluateUnion)(remaining);
  return result;
} /* v9-178be2b8ef543d3f */
