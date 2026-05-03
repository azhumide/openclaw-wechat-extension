"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromEnumKey = FromEnumKey;
var _enum_to_union = require("../enum/enum_to_union.mjs");
var _from_key = require("./from_key.mjs"); // deno-fmt-ignore-file
function FromEnumKey(values, value) {
  const unionKey = (0, _enum_to_union.EnumValuesToUnion)(values);
  const result = (0, _from_key.FromKey)(unionKey, value);
  return result;
} /* v9-cafda6277d2d4d6e */
