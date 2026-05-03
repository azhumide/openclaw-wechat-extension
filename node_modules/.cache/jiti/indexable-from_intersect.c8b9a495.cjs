"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromIntersect = FromIntersect;
var _evaluate = require("../evaluate/evaluate.mjs");
var _from_type = require("./from_type.mjs"); // deno-fmt-ignore-file
function FromIntersect(types) {
  const evaluated = (0, _evaluate.EvaluateIntersect)(types);
  const result = (0, _from_type.FromType)(evaluated);
  return result;
} /* v9-10545ff59985f117 */
