"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsMatch = IsMatch;exports.Match = Match;
var _guard = require("./guard.mjs"); // deno-coverage-ignore-start - parsebox tested
/** Checks the value is a Tuple-2 [string, string] result */
function IsMatch(value) {
  return (0, _guard.IsEqual)(value.length, 2);
}
/** Matches on a result and dispatches either left or right arm */
function Match(input, ok, fail) {
  return IsMatch(input) ? ok(input[0], input[1]) : fail();
}
// deno-coverage-ignore-stop /* v9-2a35c1d5c2ac29b0 */
