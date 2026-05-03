"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Until = Until;

var _match = require("./internal/match.mjs");
var _guard = require("./internal/guard.mjs"); // deno-coverage-ignore-start - parsebox tested
// deno-fmt-ignore-file
function TakeOne(input) {const result = (0, _guard.IsEqual)(input, '') ? [] : [input.slice(0, 1), input.slice(1)];
  return result;
}
function IsInputMatchSentinal(end, input) {
  return (0, _guard.TakeLeft)(end, (left, right) => input.startsWith(left) ?
  true :
  IsInputMatchSentinal(right, input), () => false);
}
/** Match Input until but not including End. No match if End not found. */
function Until(end, input, result = '') {
  return (0, _match.Match)(TakeOne(input), (One, Rest) => IsInputMatchSentinal(end, input) ?
  [result, input] // ok: at sentinal 
  : Until(end, Rest, `${result}${One}`) // fail: advance + 1
  , () => []);
}
// deno-coverage-ignore-stop /* v9-6b615db54ced7611 */
