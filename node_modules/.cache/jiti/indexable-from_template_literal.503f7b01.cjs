"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromTemplateLiteral = FromTemplateLiteral;
var _decode = require("../template_literal/decode.mjs");
var _from_type = require("./from_type.mjs"); // deno-fmt-ignore-file
function FromTemplateLiteral(pattern) {
  const decoded = (0, _decode.TemplateLiteralDecode)(pattern);
  const result = (0, _from_type.FromType)(decoded);
  return result;
} /* v9-db545c61e51b7d97 */
