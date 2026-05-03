"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromUnion = FromUnion;
var _union = require("../../types/union.mjs");
var _from_type = require("./from_type.mjs"); // deno-fmt-ignore-file
function FromUnion(types) {
  const result = types.map((type) => (0, _from_type.FromType)(type));
  return (0, _union.Union)(result);
} /* v9-f530d65019eea2eb */
