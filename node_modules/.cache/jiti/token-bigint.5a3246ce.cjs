"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.BigInt = BigInt;

var _match = require("./internal/match.mjs");
var _take = require("./internal/take.mjs");
var _integer = require("./integer.mjs"); // deno-coverage-ignore-start - parsebox tested
// deno-fmt-ignore-file
function TakeBigInt(input) {return (0, _match.Match)((0, _integer.Integer)(input), (Integer, IntegerRest) => (0, _match.Match)((0, _take.Take)(['n'], IntegerRest), (_N, NRest) => [`${Integer}`, NRest], () => []), // fail: did not match 'n'
  () => []); // fail: did not match Integer
}
/** Matches if next is a Integer literal with trailing 'n'. Trailing 'n' is omitted in result. */
function BigInt(input) {
  return TakeBigInt(input);
}
// deno-coverage-ignore-stop /* v9-52b10d6d64d39743 */
