"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Rest = Rest;

var _guard = require("./internal/guard.mjs"); // deno-coverage-ignore-start - parsebox tested
// deno-fmt-ignore-file
/** Match remaining characters in the buffer until end. If no characters are in buffer, no match */function Rest(input) {
  const result = (0, _guard.IsEqual)(input, '') ? [] : [input, ''];
  return result;
}
// deno-coverage-ignore-stop /* v9-7ae0d8cf994fd258 */
