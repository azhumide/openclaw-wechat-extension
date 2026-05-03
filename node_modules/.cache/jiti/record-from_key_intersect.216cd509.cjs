"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromIntersectKey = FromIntersectKey;
var _evaluate = require("../evaluate/evaluate.mjs");
var _from_key = require("./from_key.mjs"); // deno-fmt-ignore-file
function FromIntersectKey(types, value) {
  const evaluatedKey = (0, _evaluate.EvaluateIntersect)(types);
  const result = (0, _from_key.FromKey)(evaluatedKey, value);
  return result;
} /* v9-abf52e74a1e96b7e */
