"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromAny = FromAny;
var _number = require("../../types/number.mjs");
var _string = require("../../types/string.mjs");
var _symbol = require("../../types/symbol.mjs");
var _union = require("../../types/union.mjs"); // deno-fmt-ignore-file
function FromAny() {
  return (0, _union.Union)([(0, _number.Number)(), (0, _string.String)(), (0, _symbol.Symbol)()]);
} /* v9-a3920ed89c4841b4 */
