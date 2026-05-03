"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Ident = Ident;

var _match = require("./internal/match.mjs");
var _trim = require("./internal/trim.mjs");
var _take = require("./internal/take.mjs");
var _char = require("./internal/char.mjs"); // deno-coverage-ignore-start - parsebox tested
// deno-fmt-ignore-file


const Initial = [..._char.Alpha, _char.UnderScore, _char.DollarSign];
function TakeInitial(input) {
  return (0, _take.Take)(Initial, input);
}
const Remaining = [...Initial, ..._char.Digit];
function TakeRemaining(input, result = '') {
  return (0, _match.Match)((0, _take.Take)(Remaining, input), (Remaining, RemainingRest) => TakeRemaining(RemainingRest, `${result}${Remaining}`), () => [result, input]);
}
function TakeIdent(input) {
  return (0, _match.Match)(TakeInitial(input), (Initial, InitialRest) => (0, _match.Match)(TakeRemaining(InitialRest), (Remaining, RemainingRest) => [`${Initial}${Remaining}`, RemainingRest], () => []), // fail: did not match Remaining
  () => []); // fail: did not match Initial
}
/** Matches if next is an Ident */
function Ident(input) {
  return TakeIdent((0, _trim.Trim)(input));
}
// deno-coverage-ignore-stop /* v9-b13111e2b96dfe69 */
