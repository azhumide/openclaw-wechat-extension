"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromTemplateKey = FromTemplateKey;
var _from_key = require("./from_key.mjs");
var _pattern = require("../patterns/pattern.mjs");
var _is_finite = require("../template_literal/is_finite.mjs");
var _decode = require("../template_literal/decode.mjs");
var _record_create = require("./record_create.mjs"); // deno-fmt-ignore-file
function FromTemplateKey(pattern, value) {
  const types = (0, _pattern.ParsePatternIntoTypes)(pattern);
  const finite = (0, _is_finite.IsTemplateLiteralFinite)(types);
  const result = finite ? (0, _from_key.FromKey)((0, _decode.TemplateLiteralDecode)(pattern), value) : (0, _record_create.CreateRecord)(pattern, value);
  return result;
} /* v9-d8c5e1f32a819aa6 */
