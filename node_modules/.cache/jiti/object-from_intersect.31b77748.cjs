"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromIntersect = FromIntersect;

var _index = require("../../../system/memory/index.mjs");
var _index2 = require("../../../guard/index.mjs");
var _from_type = require("./from_type.mjs");
var _evaluate = require("../evaluate/evaluate.mjs"); // deno-lint-ignore-file ban-types
// deno-fmt-ignore-file
function CollapseIntersectProperties(left, right) {const leftKeys = _index2.Guard.Keys(left).filter((key) => !_index2.Guard.HasPropertyKey(right, key));
  const rightKeys = _index2.Guard.Keys(right).filter((key) => !_index2.Guard.HasPropertyKey(left, key));
  const sharedKeys = _index2.Guard.Keys(left).filter((key) => _index2.Guard.HasPropertyKey(right, key));
  const leftProperties = leftKeys.reduce((result, key) => ({ ...result, [key]: left[key] }), {});
  const rightProperties = rightKeys.reduce((result, key) => ({ ...result, [key]: right[key] }), {});
  const sharedProperties = sharedKeys.reduce((result, key) => ({ ...result, [key]: (0, _evaluate.EvaluateIntersect)([left[key], right[key]]) }), {});
  const unique = _index.Memory.Assign(leftProperties, rightProperties);
  const shared = _index.Memory.Assign(unique, sharedProperties);
  return shared;
}
function FromIntersect(types) {
  return types.reduce((result, left) => {
    return CollapseIntersectProperties(result, (0, _from_type.FromType)(left));
  }, {});
} /* v9-7bf88d121d380fbb */
