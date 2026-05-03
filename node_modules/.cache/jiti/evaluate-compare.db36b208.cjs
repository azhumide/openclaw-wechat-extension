"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Compare = Compare;exports.ResultRightInside = exports.ResultLeftInside = exports.ResultEqual = exports.ResultDisjoint = void 0;

var _unknown = require("../../types/unknown.mjs");
var _index = require("../../extends/index.mjs"); // deno-lint-ignore-file ban-types
// deno-fmt-ignore-file
// ------------------------------------------------------------------
// TCompare
// ------------------------------------------------------------------
const ResultEqual = exports.ResultEqual = 'equal';const ResultDisjoint = exports.ResultDisjoint = 'disjoint';
const ResultLeftInside = exports.ResultLeftInside = 'left-inside';
const ResultRightInside = exports.ResultRightInside = 'right-inside';
/** Compares left and right types and determines their set relationship. */
function Compare(left, right) {
  const extendsCheck = [
  (0, _unknown.IsUnknown)(left) ? _index.ExtendsResult.ExtendsFalse() : (0, _index.Extends)({}, left, right),
  (0, _unknown.IsUnknown)(left) ? _index.ExtendsResult.ExtendsTrue({}) : (0, _index.Extends)({}, right, left)];

  return _index.ExtendsResult.IsExtendsTrueLike(extendsCheck[0]) && _index.ExtendsResult.IsExtendsTrueLike(extendsCheck[1]) ? ResultEqual :
  _index.ExtendsResult.IsExtendsTrueLike(extendsCheck[0]) && _index.ExtendsResult.IsExtendsFalse(extendsCheck[1]) ? ResultLeftInside :
  _index.ExtendsResult.IsExtendsFalse(extendsCheck[0]) && _index.ExtendsResult.IsExtendsTrueLike(extendsCheck[1]) ? ResultRightInside :
  ResultDisjoint;
} /* v9-7d2d0b60a6025f88 */
