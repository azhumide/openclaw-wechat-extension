"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.KeysToIndexer = KeysToIndexer;
var _literal = require("../../types/literal.mjs");
var _union = require("../../types/union.mjs"); // deno-fmt-ignore-file
function KeysToLiterals(keys) {
  return keys.reduce((result, left) => {
    return (0, _literal.IsLiteralValue)(left) ?
    [...result, (0, _literal.Literal)(left)] :
    result;
  }, []);
}
function KeysToIndexer(keys) {
  const literals = KeysToLiterals(keys);
  const result = (0, _union.Union)(literals);
  return result;
} /* v9-281671e022b655f1 */
