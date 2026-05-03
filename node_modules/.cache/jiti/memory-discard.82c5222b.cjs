"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Discard = Discard;

var _metrics = require("./metrics.mjs");
var _clone = require("./clone.mjs"); // deno-lint-ignore-file no-explicit-any
// deno-fmt-ignore-file
/** Discards multiple property keys from the given object value */function Discard(value, propertyKeys) {
  _metrics.Metrics.discard += 1;
  const result = {};
  const descriptors = Object.getOwnPropertyDescriptors((0, _clone.Clone)(value));
  const keysToDiscard = new Set(propertyKeys);
  for (const key of Object.keys(descriptors)) {
    if (keysToDiscard.has(key))
    continue;
    Object.defineProperty(result, key, descriptors[key]);
  }
  return result;
} /* v9-de3916cdd677cf61 */
