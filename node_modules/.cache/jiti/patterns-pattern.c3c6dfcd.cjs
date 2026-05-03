"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ParsePatternIntoTypes = ParsePatternIntoTypes;
var _index = require("../../../guard/index.mjs");
var _parser = require("../../script/parser.mjs"); // deno-fmt-ignore-file
/** Parses a Pattern into a sequence of TemplateLiteral types. A result of [] indicates failure to parse. */
function ParsePatternIntoTypes(pattern) {
  const parsed = (0, _parser.Pattern)(pattern);
  const result = _index.Guard.IsEqual(parsed.length, 2) ?
  parsed[0] :
  []; // Failed to Parse
  return result;
} /* v9-274108b75065153d */
