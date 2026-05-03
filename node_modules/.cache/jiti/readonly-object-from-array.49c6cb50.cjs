"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromArray = FromArray;
var _array = require("../../types/array.mjs");
var _immutable = require("../../types/_immutable.mjs"); // deno-fmt-ignore-file
function FromArray(type) {
  const result = (0, _immutable.Immutable)((0, _array.Array)(type));
  return result;
} /* v9-b6ee9ed6dbe90ea1 */
