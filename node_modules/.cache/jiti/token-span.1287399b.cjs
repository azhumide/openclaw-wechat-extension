"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Span = Span;

var _match = require("./internal/match.mjs");
var _trim = require("./internal/trim.mjs");
var _char = require("./internal/char.mjs");
var _take = require("./internal/take.mjs");
var _until = require("./until.mjs"); // deno-coverage-ignore-start - parsebox tested
// deno-fmt-ignore-file
function MultiLine(start, end, input) {return (0, _match.Match)((0, _take.Take)([start], input), (_, Rest) => (0, _match.Match)((0, _until.Until)([end], Rest), (Until, UntilRest) => (0, _match.Match)((0, _take.Take)([end], UntilRest), (_, Rest) => [`${Until}`, Rest], () => []), // fail: did not match End
  () => []), // fail: did not match Until
  () => []); // fail: did not match Start
}
function SingleLine(start, end, input) {
  return (0, _match.Match)((0, _take.Take)([start], input), (_, Rest) => (0, _match.Match)((0, _until.Until)([_char.NewLine, end], Rest), (Until, UntilRest) => (0, _match.Match)((0, _take.Take)([end], UntilRest), (_, EndRest) => [`${Until}`, EndRest], () => []), // fail: did not match End
  () => []), // fail: did not match Until
  () => []); // fail: not match Start
}
/** Matches from Start and End capturing everything in-between. Start and End are consumed. */
function Span(start, end, multiLine, input) {
  return multiLine ?
  MultiLine(start, end, (0, _trim.Trim)(input)) :
  SingleLine(start, end, (0, _trim.Trim)(input));
}
// deno-coverage-ignore-stop /* v9-245b3b1e9a6b158d */
