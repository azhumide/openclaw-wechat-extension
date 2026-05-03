"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ExtendsTemplateLiteral = ExtendsTemplateLiteral;
var _extends_left = require("./extends_left.mjs");
var _decode = require("../engine/template_literal/decode.mjs"); // deno-fmt-ignore-file
function ExtendsTemplateLiteral(inferred, left, right) {
  const decoded = (0, _decode.TemplateLiteralDecode)(left);
  return (0, _extends_left.ExtendsLeft)(inferred, decoded, right);
} /* v9-8242ddb4845d71d0 */
