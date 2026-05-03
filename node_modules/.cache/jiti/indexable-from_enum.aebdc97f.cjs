"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromEnum = FromEnum;
var _enum_to_union = require("../enum/enum_to_union.mjs");
var _from_union = require("./from_union.mjs"); // deno-fmt-ignore-file
function FromEnum(values) {
  const variants = (0, _enum_to_union.EnumValuesToVariants)(values);
  const result = (0, _from_union.FromUnion)(variants);
  return result;
} /* v9-e4cf840cf8095535 */
