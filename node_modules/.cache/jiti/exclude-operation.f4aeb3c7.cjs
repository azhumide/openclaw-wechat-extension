"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ExcludeOperation = ExcludeOperation;

var _enum = require("../../types/enum.mjs");
var _union = require("../../types/union.mjs");
var _index = require("../../extends/index.mjs");
var _index2 = require("../enum/index.mjs");
var _index3 = require("../evaluate/index.mjs"); // deno-lint-ignore-file ban-types
// deno-fmt-ignore-file
function ExcludeUnionLeft(types, right) {return types.reduce((result, head) => {
    return [...result, ...ExcludeTypeLeft(head, right)];
  }, []);
}
function ExcludeTypeLeft(left, right) {
  const check = (0, _index.Extends)({}, left, right);
  const result = _index.ExtendsResult.IsExtendsTrueLike(check) ? [] : [left];
  return result;
}
function ExcludeOperation(left, right) {
  const remaining = (0, _enum.IsEnum)(left) ? ExcludeUnionLeft((0, _index2.EnumValuesToVariants)(left.enum), right) :
  (0, _union.IsUnion)(left) ? ExcludeUnionLeft((0, _index3.Flatten)(left.anyOf), right) :
  ExcludeTypeLeft(left, right);
  const result = (0, _index3.EvaluateUnion)(remaining);
  return result;
} /* v9-0498460af13a3288 */
