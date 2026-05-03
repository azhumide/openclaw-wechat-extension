"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromType = FromType;
var _literal = require("../../types/literal.mjs");
var _template_literal = require("../../types/template_literal.mjs");
var _union = require("../../types/union.mjs");
var _from_literal = require("./from_literal.mjs");
var _from_template_literal = require("./from_template_literal.mjs");
var _from_union = require("./from_union.mjs"); // deno-fmt-ignore-file
function FromType(mapping, type) {
  return (0, _literal.IsLiteral)(type) ? (0, _from_literal.FromLiteral)(mapping, type.const) :
  (0, _template_literal.IsTemplateLiteral)(type) ? (0, _from_template_literal.FromTemplateLiteral)(mapping, type.pattern) :
  (0, _union.IsUnion)(type) ? (0, _from_union.FromUnion)(mapping, type.anyOf) :
  type;
} /* v9-23ac0d712fa72d4b */
