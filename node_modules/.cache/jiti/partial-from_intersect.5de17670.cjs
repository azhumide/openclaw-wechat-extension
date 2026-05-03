"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromIntersect = FromIntersect;
var _from_type = require("./from_type.mjs");
var _evaluate = require("../evaluate/evaluate.mjs"); // deno-fmt-ignore-file
function FromIntersect(types) {
  const result = types.map((type) => (0, _from_type.FromType)(type));
  return (0, _evaluate.EvaluateIntersect)(result);
} /* v9-840031c80a22e1fc */
