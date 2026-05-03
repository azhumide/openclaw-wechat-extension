"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsTemplateLiteralPattern = IsTemplateLiteralPattern;
var _index = require("../../../guard/index.mjs");
var _pattern = require("../patterns/pattern.mjs"); // deno-fmt-ignore-file
/** Returns true if this pattern is a valid Template Literal regular expression */
function IsTemplateLiteralPattern(pattern) {
  const types = (0, _pattern.ParsePatternIntoTypes)(pattern);
  const result = _index.Guard.IsEqual(types.length, 0) ? false : true;
  return result;
} /* v9-04771fbb43d68c9c */
