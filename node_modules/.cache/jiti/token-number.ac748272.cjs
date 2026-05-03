"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Number = Number;

var _match = require("./internal/match.mjs");
var _trim = require("./internal/trim.mjs");
var _optional = require("./internal/optional.mjs");
var _char = require("./internal/char.mjs");
var _unsigned_number = require("./unsigned_number.mjs"); // deno-coverage-ignore-start - parsebox tested
// deno-fmt-ignore-file
function TakeSign(input) {return (0, _optional.Optional)(_char.Hyphen, input);
}
function TakeSignedNumber(input) {
  return (0, _match.Match)(TakeSign(input), (Sign, SignRest) => (0, _match.Match)((0, _unsigned_number.UnsignedNumber)(SignRest), (UnsignedInteger, UnsignedIntegerRest) => [`${Sign}${UnsignedInteger}`, UnsignedIntegerRest], () => []), // fail: did not match unsigned integer
  () => []); // fail: did not match Sign
}
/** Matches if next is a signed or unsigned Number */
function Number(input) {
  return TakeSignedNumber((0, _trim.Trim)(input));
}
// deno-coverage-ignore-stop /* v9-adb83cc157f8cd54 */
