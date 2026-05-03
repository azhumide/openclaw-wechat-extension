"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromTuple = FromTuple;
var _tuple = require("../../types/tuple.mjs");
var _immutable = require("../../types/_immutable.mjs"); // deno-fmt-ignore-file
function FromTuple(types) {
  const result = (0, _immutable.Immutable)((0, _tuple.Tuple)(types));
  return result;
} /* v9-d7914a046cd5758c */
