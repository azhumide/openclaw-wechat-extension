"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Const = Const;

var _guard = require("./internal/guard.mjs");
var _trim = require("./internal/trim.mjs");

var _take = require("./internal/take.mjs");
var _char = require("./internal/char.mjs"); // deno-coverage-ignore-start - parsebox tested
// deno-fmt-ignore-file
function TakeConst(const_, input) {
  return (0, _take.Take)([const_], input);
}
/** Matches if next is the given Const value */
function Const(const_, input) {
  return (0, _guard.IsEqual)(const_, '') ? ['', input] : const_.startsWith(_char.NewLine) ? TakeConst(const_, (0, _trim.TrimWhitespace)(input)) :
  const_.startsWith(_char.WhiteSpace) ? TakeConst(const_, input) :
  TakeConst(const_, (0, _trim.Trim)(input));
}
// deno-coverage-ignore-stop /* v9-db38cd9396f5c233 */
