"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromTemplateLiteral = FromTemplateLiteral;
var _decode = require("../template_literal/decode.mjs");
var _from_type = require("./from_type.mjs"); // deno-fmt-ignore-file
function FromTemplateLiteral(mapping, pattern) {
  const decoded = (0, _decode.TemplateLiteralDecode)(pattern);
  const result = (0, _from_type.FromType)(mapping, decoded);
  return result;
} /* v9-1d83543b8c5e8c7e */
