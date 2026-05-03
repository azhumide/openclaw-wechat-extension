"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Integer = Integer;

var _match = require("./internal/match.mjs");
var _trim = require("./internal/trim.mjs");
var _optional = require("./internal/optional.mjs");
var _char = require("./internal/char.mjs");
var _unsigned_integer = require("./unsigned_integer.mjs"); // deno-coverage-ignore-start - parsebox tested
// deno-fmt-ignore-file
function TakeSign(input) {return (0, _optional.Optional)(_char.Hyphen, input);
}
function TakeSignedInteger(input) {
  return (0, _match.Match)(TakeSign(input), (Sign, SignRest) => (0, _match.Match)((0, _unsigned_integer.UnsignedInteger)(SignRest), (UnsignedInteger, UnsignedIntegerRest) => [`${Sign}${UnsignedInteger}`, UnsignedIntegerRest], () => []), // fail: did not match unsigned integer
  () => []); // fail: did not match Sign
}
/** Matches if next is a signed or unsigned Integer */
function Integer(input) {
  return TakeSignedInteger((0, _trim.Trim)(input));
}
// deno-coverage-ignore-stop /* v9-e16e4ded4135c700 */
