"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsTemplateLiteralFinite = IsTemplateLiteralFinite;
var _index = require("../../../guard/index.mjs");
var _literal = require("../../types/literal.mjs");
var _union = require("../../types/union.mjs"); // deno-fmt-ignore-file
function FromLiteral(_value) {
  return true;
}
function FromTypesReduce(types) {
  return _index.Guard.TakeLeft(types, (left, right) => FromType(left) ?
  FromTypesReduce(right) :
  false, () => true);
}
function FromTypes(types) {
  const result = _index.Guard.IsEqual(types.length, 0) ? false : FromTypesReduce(types);
  return result;
}
function FromType(type) {
  return (0, _union.IsUnion)(type) ? FromTypes(type.anyOf) :
  (0, _literal.IsLiteral)(type) ? FromLiteral(type.const) :
  false;
}
/** Returns true if the given TemplateLiteral types yields a finite variant set */
function IsTemplateLiteralFinite(types) {
  const result = FromTypes(types);
  return result;
} /* v9-aeb778d49acb219c */
