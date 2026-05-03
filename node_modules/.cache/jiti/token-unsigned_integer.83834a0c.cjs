"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.UnsignedInteger = UnsignedInteger;

var _match = require("./internal/match.mjs");
var _trim = require("./internal/trim.mjs");
var _take = require("./internal/take.mjs");
var _many = require("./internal/many.mjs");
var _char = require("./internal/char.mjs"); // deno-coverage-ignore-start - parsebox tested
// deno-fmt-ignore-file


function TakeNonZero(input) {
  return (0, _take.Take)(_char.NonZero, input);
}
const AllowedDigits = [..._char.Digit, _char.UnderScore];
function TakeDigits(input) {
  return (0, _many.Many)(AllowedDigits, [_char.UnderScore], input);
}
function TakeUnsignedInteger(input) {
  return (0, _match.Match)((0, _take.Take)([_char.Zero], input), (Zero, ZeroRest) => [Zero, ZeroRest], () => (0, _match.Match)(TakeNonZero(input), (NonZero, NonZeroRest) => (0, _match.Match)(TakeDigits(NonZeroRest), (Digits, DigitsRest) => [`${NonZero}${Digits}`, DigitsRest], () => []), // fail: did not match Digits
  () => [])); // fail: did not match NonZero
}
/** Matches if next is a UnsignedInteger */
function UnsignedInteger(input) {
  return TakeUnsignedInteger((0, _trim.Trim)(input));
}
// deno-coverage-ignore-stop /* v9-0aacf98b686a8de7 */
