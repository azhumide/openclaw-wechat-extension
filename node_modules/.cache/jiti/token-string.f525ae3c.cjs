"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.String = String;

var _match = require("./internal/match.mjs");
var _take = require("./internal/take.mjs");
var _trim = require("./internal/trim.mjs");
var _span = require("./span.mjs"); // deno-coverage-ignore-start - parsebox tested
// deno-fmt-ignore-file
function TakeInitial(quotes, input) {return (0, _take.Take)(quotes, input);
}
function TakeSpan(quote, input) {
  return (0, _span.Span)(quote, quote, false, input);
}
function TakeString(quotes, input) {
  return (0, _match.Match)(TakeInitial(quotes, input), (Initial, InitialRest) => TakeSpan(Initial, `${Initial}${InitialRest}`), () => []); // fail: did not match Initial
}
/** Matches a literal String with the given quotes */
function String(quotes, input) {
  return TakeString(quotes, (0, _trim.Trim)(input));
}
// deno-coverage-ignore-stop /* v9-8c01d3f1e8e420b5 */
