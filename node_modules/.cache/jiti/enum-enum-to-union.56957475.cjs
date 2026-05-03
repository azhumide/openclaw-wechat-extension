"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.EnumToUnion = EnumToUnion;exports.EnumValuesToUnion = EnumValuesToUnion;exports.EnumValuesToVariants = EnumValuesToVariants;
var _index = require("../../../guard/index.mjs");
var _union = require("../../types/union.mjs");
var _literal = require("../../types/literal.mjs");
var _null = require("../../types/null.mjs");
var _never = require("../../types/never.mjs"); // deno-fmt-ignore-file
function FromEnumValue(value) {
  return _index.Guard.IsString(value) || _index.Guard.IsNumber(value) ? (0, _literal.Literal)(value) :
  _index.Guard.IsNull(value) ? (0, _null.Null)() :
  (0, _never.Never)();
}
function EnumValuesToVariants(values) {
  const result = values.map((value) => FromEnumValue(value));
  return result;
}
function EnumValuesToUnion(values) {
  const variants = EnumValuesToVariants(values);
  const result = (0, _union.Union)(variants);
  return result;
}
function EnumToUnion(type) {
  const result = EnumValuesToUnion(type.enum);
  return result;
} /* v9-2c0a2aba44dd30dd */
