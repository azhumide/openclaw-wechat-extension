"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Many = Many;

var _match = require("./match.mjs");
var _take = require("./take.mjs"); // deno-coverage-ignore-start - parsebox tested
// deno-fmt-ignore-file
function IsDiscard(discard, input) {return discard.includes(input);
}
/** Takes characters from the Input until no-match. The Discard set is used to omit characters from the match */
function Many(allowed, discard, input, result = '') {
  return (0, _match.Match)((0, _take.Take)(allowed, input), (Char, Rest) => IsDiscard(discard, Char) ?
  Many(allowed, discard, Rest, result) :
  Many(allowed, discard, Rest, `${result}${Char}`), () => [result, input]);
}
// deno-coverage-ignore-stop /* v9-0593acf6e242fcfc */
