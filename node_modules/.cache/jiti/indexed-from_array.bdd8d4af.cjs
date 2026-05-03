"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromArray = FromArray;exports.NormalizeIndexer = NormalizeIndexer;

var _index = require("../../../guard/index.mjs");
var _intersect = require("../../types/intersect.mjs");
var _union = require("../../types/union.mjs");
var _literal = require("../../types/literal.mjs");
var _number = require("../../types/number.mjs");
var _never = require("../../types/never.mjs");
var _index2 = require("../../extends/index.mjs");
var _keys = require("../helpers/keys.mjs"); // deno-lint-ignore-file ban-types
// deno-fmt-ignore-file
function NormalizeLiteral(value) {return (0, _literal.Literal)((0, _keys.ConvertToIntegerKey)(value));
}
function NormalizeIndexerTypes(types) {
  return types.map((type) => NormalizeIndexer(type));
}
function NormalizeIndexer(type) {
  return (0, _intersect.IsIntersect)(type) ? (0, _intersect.Intersect)(NormalizeIndexerTypes(type.allOf)) :
  (0, _union.IsUnion)(type) ? (0, _union.Union)(NormalizeIndexerTypes(type.anyOf)) :
  (0, _literal.IsLiteral)(type) ? NormalizeLiteral(type.const) :
  type;
}
function FromArray(type, indexer) {
  const normalizedIndexer = NormalizeIndexer(indexer);
  const check = (0, _index2.Extends)({}, normalizedIndexer, (0, _number.Number)());
  const result =
  // indexer
  _index2.ExtendsResult.IsExtendsTrueLike(check) ?
  type
  // length (intrinsic)
  : (0, _literal.IsLiteral)(indexer) && _index.Guard.IsEqual(indexer.const, 'length') ?
  (0, _number.Number)() :
  (0, _never.Never)();
  return result;
} /* v9-0215fcc323a0ef1b */
