"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Narrow = Narrow;
var _index = require("../../../guard/index.mjs");
var _never = require("../../types/never.mjs");
var _compare = require("./compare.mjs"); // deno-fmt-ignore-file
function Narrow(left, right) {
  const result = (0, _compare.Compare)(left, right);
  return _index.Guard.IsEqual(result, _compare.ResultLeftInside) ? left :
  _index.Guard.IsEqual(result, _compare.ResultRightInside) ? right :
  _index.Guard.IsEqual(result, _compare.ResultEqual) ? right :
  (0, _never.Never)();
} /* v9-7d5d2c62b5c6b607 */
