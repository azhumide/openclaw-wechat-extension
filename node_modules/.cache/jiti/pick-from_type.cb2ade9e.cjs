"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromType = FromType;

var _index = require("../../../system/memory/index.mjs");
var _index2 = require("../../../guard/index.mjs");
var _object = require("../../types/object.mjs");
var _to_indexable_keys = require("../indexable/to_indexable_keys.mjs");
var _to_indexable = require("../indexable/to_indexable.mjs"); // deno-lint-ignore-file ban-types
// deno-fmt-ignore-file
function FromKeys(properties, keys) {const result = _index2.Guard.Keys(properties).reduce((result, key) => {
    return keys.includes(key) ? _index.Memory.Assign(result, { [key]: properties[key] }) : result;
  }, {});
  return result;
}
function FromType(type, indexer) {
  const indexable = (0, _to_indexable.ToIndexable)(type);
  const keys = (0, _to_indexable_keys.ToIndexableKeys)(indexer);
  const applied = FromKeys(indexable, keys);
  const result = (0, _object.Object)(applied);
  return result;
} /* v9-02df4055747277a8 */
