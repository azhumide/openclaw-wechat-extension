"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ParseTemplateIntoTypes = ParseTemplateIntoTypes;
var _index = require("../../../system/unreachable/index.mjs");
var _index2 = require("../../../guard/index.mjs");
var _parser = require("../../script/parser.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// deno-coverage-ignore-start - symmetric unreachable
//
// Parser is parsing regular expression for strings and will return 
// at least 1 TLiteral at a minumum.
//
// ------------------------------------------------------------------
/** Parses a Template into a TemplateLiteral types */
function ParseTemplateIntoTypes(template) {
  const parsed = (0, _parser.TemplateLiteralTypes)(`\`${template}\``);
  const result = _index2.Guard.IsEqual(parsed.length, 2) ?
  parsed[0] :
  (0, _index.Unreachable)(); // []
  return result;
}
// deno-coverage-ignore-stop /* v9-9fb5744b305c2f9f */
