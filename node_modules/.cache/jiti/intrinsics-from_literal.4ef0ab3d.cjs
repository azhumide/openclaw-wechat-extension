"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromLiteral = FromLiteral;
var _index = require("../../../guard/index.mjs");
var _literal = require("../../types/literal.mjs");
var _mapping = require("./mapping.mjs"); // deno-fmt-ignore-file
function FromLiteral(mapping, value) {
  return _index.Guard.IsString(value) ?
  (0, _literal.Literal)((0, _mapping.ApplyMapping)(mapping, value)) :
  (0, _literal.Literal)(value);
} /* v9-8efc2a2251d19be5 */
