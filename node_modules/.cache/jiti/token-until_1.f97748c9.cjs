"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Until_1 = Until_1;

var _guard = require("./internal/guard.mjs");
var _match = require("./internal/match.mjs");
var _until = require("./until.mjs"); // deno-coverage-ignore-start - parsebox tested
// deno-fmt-ignore-file
/** Match Input until but not including End. No match if End not found or match is zero-length. */function Until_1(end, input) {
  return (0, _match.Match)((0, _until.Until)(end, input), (Until, UntilRest) => (0, _guard.IsEqual)(Until, '') ?
  [] // fail: match has no characters
  : [Until, UntilRest], () => []); // fail: did not match Until
}
// deno-coverage-ignore-stop /* v9-5b67061248ce51f3 */
