"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromType = FromType;
var _index = require("../../../guard/index.mjs");
var _object = require("../../types/object.mjs");
var _to_indexable_keys = require("../indexable/to_indexable_keys.mjs");
var _to_indexable = require("../indexable/to_indexable.mjs"); // deno-fmt-ignore-file
function FromKeys(properties, keys) {
  const result = _index.Guard.Keys(properties).reduce((result, key) => {
    return keys.includes(key) ? result : { ...result, [key]: properties[key] };
  }, {});
  return result;
}
function FromType(type, indexer) {
  const indexable = (0, _to_indexable.ToIndexable)(type);
  const indexableKeys = (0, _to_indexable_keys.ToIndexableKeys)(indexer);
  const omitted = FromKeys(indexable, indexableKeys);
  const result = (0, _object.Object)(omitted);
  return result;
} /* v9-90b333021e81d431 */
