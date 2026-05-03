"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromType = FromType;
var _cyclic = require("../../types/cyclic.mjs");
var _enum = require("../../types/enum.mjs");
var _intersect = require("../../types/intersect.mjs");
var _literal = require("../../types/literal.mjs");
var _template_literal = require("../../types/template_literal.mjs");
var _union = require("../../types/union.mjs");
var _from_cyclic = require("./from_cyclic.mjs");
var _from_enum = require("./from_enum.mjs");
var _from_intersect = require("./from_intersect.mjs");
var _from_literal = require("./from_literal.mjs");
var _from_template_literal = require("./from_template_literal.mjs");
var _from_union = require("./from_union.mjs"); // deno-fmt-ignore-file
function FromType(type) {
  return (0, _cyclic.IsCyclic)(type) ? (0, _from_cyclic.FromCyclic)(type.$defs, type.$ref) :
  (0, _enum.IsEnum)(type) ? (0, _from_enum.FromEnum)(type.enum) :
  (0, _intersect.IsIntersect)(type) ? (0, _from_intersect.FromIntersect)(type.allOf) :
  (0, _literal.IsLiteral)(type) ? (0, _from_literal.FromLiteral)(type.const) :
  (0, _template_literal.IsTemplateLiteral)(type) ? (0, _from_template_literal.FromTemplateLiteral)(type.pattern) :
  (0, _union.IsUnion)(type) ? (0, _from_union.FromUnion)(type.anyOf) :
  [];
} /* v9-309ca756e7013171 */
