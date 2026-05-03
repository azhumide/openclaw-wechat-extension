"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ToIndexableKeys = ToIndexableKeys;
var _from_type = require("./from_type.mjs"); // deno-fmt-ignore-file
/**
 * Transforms a type meant as an Indexer into string[] array which is used by Indexable types
 * like Index, Pick and Omit to select from property keys. This function should only be used
 * for Object key selection, and not for Array / Tuple key selection as Array-Like structures
 * require TNumber indexing support.
 */
function ToIndexableKeys(type) {
  const result = (0, _from_type.FromType)(type);
  return result;
} /* v9-57e8b1b161f730f3 */
