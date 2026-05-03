"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.UnsignedNumber = UnsignedNumber;

var _guard = require("./internal/guard.mjs");
var _match = require("./internal/match.mjs");
var _trim = require("./internal/trim.mjs");
var _take = require("./internal/take.mjs");
var _many = require("./internal/many.mjs");
var _char = require("./internal/char.mjs");

var _unsigned_integer = require("./unsigned_integer.mjs"); // deno-coverage-ignore-start - parsebox tested
// deno-fmt-ignore-file
const AllowedDigits = [..._char.Digit, _char.UnderScore];function IsLeadingDot(input) {
  return (0, _match.IsMatch)((0, _take.Take)([_char.Dot], input));
}
function TakeFractional(input) {
  return (0, _match.Match)((0, _many.Many)(AllowedDigits, [_char.UnderScore], input), (Digits, DigitsRest) => (0, _guard.IsEqual)(Digits, '') ?
  [] // fail: no Digits
  : [Digits, DigitsRest], () => []); // fail: did not match Digits
}
function LeadingDot(input) {
  return (0, _match.Match)((0, _take.Take)([_char.Dot], input), (Dot, DotRest) => (0, _match.Match)(TakeFractional(DotRest), (Fractional, FractionalRest) => [`0${Dot}${Fractional}`, FractionalRest], () => []), // fail: did not match Fractional
  () => []); // fail: did not match Dot
}
function LeadingInteger(input) {
  return (0, _match.Match)((0, _unsigned_integer.UnsignedInteger)(input), (Integer, IntegerRest) => (0, _match.Match)((0, _take.Take)([_char.Dot], IntegerRest), (Dot, DotRest) => (0, _match.Match)(TakeFractional(DotRest), (Fractional, FractionalRest) => [`${Integer}${Dot}${Fractional}`, FractionalRest], () => [`${Integer}`, DotRest]), // fail: did not match Fractional, use Integer
  () => [`${Integer}`, IntegerRest]), // fail: did not match Dot, use Integer
  () => []); // fail: did not match Integer
}
function TakeUnsignedNumber(input) {
  return IsLeadingDot(input) ?
  LeadingDot(input) :
  LeadingInteger(input);
}
/** Matches if next is a UnsignedNumber */
function UnsignedNumber(input) {
  return TakeUnsignedNumber((0, _trim.Trim)(input));
}
// deno-coverage-ignore-stop /* v9-29982ff3efea695d */
