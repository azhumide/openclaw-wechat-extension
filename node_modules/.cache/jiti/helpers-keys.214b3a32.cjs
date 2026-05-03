"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ConvertToIntegerKey = ConvertToIntegerKey; // deno-fmt-ignore-file
const integerKeyPattern = new RegExp('^(?:0|[1-9][0-9]*)$');
function ConvertToIntegerKey(value) {
  const normal = `${value}`;
  return integerKeyPattern.test(normal) ?
  parseInt(normal) :
  value;
} /* v9-04382bf4f490f67a */
