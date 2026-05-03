"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromObject = FromObject;
var _number = require("../../types/number.mjs");
var _never = require("../../types/never.mjs");
var _properties = require("../../types/properties.mjs");
var _evaluate = require("../evaluate/evaluate.mjs");
var _to_indexable_keys = require("../indexable/to_indexable_keys.mjs");
var _record = require("../../types/record.mjs");
var _expand_this = require("../this/expand_this.mjs"); // deno-fmt-ignore-file
function IndexProperty(properties, key) {
  const selectedType = key in properties ? properties[key] : (0, _never.Never)();
  const result = (0, _expand_this.ExpandThis)(properties, selectedType);
  return result;
}
function IndexProperties(properties, keys) {
  return keys.reduce((result, left) => {
    return [...result, IndexProperty(properties, left)];
  }, []);
}
function FromIndexer(properties, indexer) {
  const keys = (0, _to_indexable_keys.ToIndexableKeys)(indexer);
  const variants = IndexProperties(properties, keys);
  const result = (0, _evaluate.EvaluateUnion)(variants);
  return result;
}
const NumericKeyPattern = new RegExp(_record.IntegerKey);
function NumericKeys(keys) {
  const result = keys.filter((key) => NumericKeyPattern.test(key));
  return result;
}
function FromIndexerNumber(properties) {
  const keys = (0, _properties.PropertyKeys)(properties);
  const numericKeys = NumericKeys(keys);
  const variants = IndexProperties(properties, numericKeys);
  const result = (0, _evaluate.EvaluateUnion)(variants);
  return result;
}
function FromObject(properties, indexer) {
  const result = (0, _number.IsNumber)(indexer) ? FromIndexerNumber(properties) : FromIndexer(properties, indexer);
  return result;
} /* v9-2f8ec67e141cfd57 */
