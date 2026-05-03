"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromUnion = FromUnion;
var _union = require("../../types/union.mjs");
var _from_type = require("./from_type.mjs"); // deno-fmt-ignore-file
function FromUnion(mapping, types) {
  const result = types.map((type) => (0, _from_type.FromType)(mapping, type));
  return (0, _union.Union)(result);
} /* v9-8971f20749fe1437 */
