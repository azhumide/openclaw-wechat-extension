"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Take = Take;

var _match = require("./match.mjs");
var _guard = require("./guard.mjs"); // deno-coverage-ignore-start - parsebox tested
// deno-fmt-ignore-file
function TakeVariant(variant, input) {return (0, _guard.IsEqual)(input.indexOf(variant), 0) ?
  [variant, input.slice(variant.length)] :
  [];
}
/** Takes one of the given variants or fail */
function Take(variants, input) {
  // ----------------------------------------------------------------
  // Symmetric
  // ----------------------------------------------------------------
  // return Guard.TakeLeft(variants, (valueLeft, valueRight) => 
  //   Match(TakeVariant(valueLeft, input), (take, rest) => 
  //     [take, rest],
  //     () => Take(valueRight, input)),
  //   () => []) as never
  // ----------------------------------------------------------------
  // Inline
  // ----------------------------------------------------------------
  for (let i = 0; i < variants.length; i++) {
    const result = TakeVariant(variants[i], input);
    if ((0, _match.IsMatch)(result))
    return result;
  }
  return [];
}
// deno-coverage-ignore-stop /* v9-bcfd23149ffa37a3 */
