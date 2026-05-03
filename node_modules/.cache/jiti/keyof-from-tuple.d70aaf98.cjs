"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromTuple = FromTuple;
var _literal = require("../../types/literal.mjs");
var _evaluate = require("../evaluate/evaluate.mjs"); // deno-fmt-ignore-file
function FromTuple(types) {
  const result = types.map((_, index) => (0, _literal.Literal)(index));
  return (0, _evaluate.EvaluateUnionFast)(result);
} /* v9-ed4f87d1b449fa85 */
