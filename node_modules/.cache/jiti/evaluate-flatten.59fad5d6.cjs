"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Flatten = Flatten;
var _union = require("../../types/union.mjs"); // deno-fmt-ignore-file
function FlattenType(type) {
  const result = (0, _union.IsUnion)(type) ? Flatten(type.anyOf) : [type];
  return result;
}
function Flatten(types) {
  return types.reduce((result, type) => {
    return [...result, ...FlattenType(type)];
  }, []);
} /* v9-e90c5049f2536284 */
