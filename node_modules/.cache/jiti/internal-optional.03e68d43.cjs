"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Optional = Optional;

var _match = require("./match.mjs");
var _take = require("./take.mjs"); // deno-coverage-ignore-start - parsebox tested
// deno-fmt-ignore-file
/** Matches the given Value or empty string if no match. This function never fails */function Optional(value, input) {
  return (0, _match.Match)((0, _take.Take)([value], input), (Optional, Rest) => [Optional, Rest], () => ['', input]);
}
// deno-coverage-ignore-stop /* v9-ea927acecd714027 */
