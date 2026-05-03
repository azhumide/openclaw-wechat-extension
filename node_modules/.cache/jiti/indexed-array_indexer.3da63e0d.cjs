"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FormatArrayIndexer = FormatArrayIndexer;
var _union = require("../../types/union.mjs");
var _intersect = require("../../types/intersect.mjs");
var _literal = require("../../types/literal.mjs");
var _keys = require("../helpers/keys.mjs"); // deno-fmt-ignore-file
function ConvertLiteral(value) {
  return (0, _literal.Literal)((0, _keys.ConvertToIntegerKey)(value));
}
function ArrayIndexerTypes(types) {
  return types.map((type) => FormatArrayIndexer(type));
}
/** Formats embedded integer-like strings on an Indexer to be number values inline with TS indexing | coercion behaviors. */
function FormatArrayIndexer(type) {
  return (0, _intersect.IsIntersect)(type) ? (0, _intersect.Intersect)(ArrayIndexerTypes(type.allOf)) :
  (0, _union.IsUnion)(type) ? (0, _union.Union)(ArrayIndexerTypes(type.anyOf)) :
  (0, _literal.IsLiteral)(type) ? ConvertLiteral(type.const) :
  type;
} /* v9-ceefea4506cc0101 */
