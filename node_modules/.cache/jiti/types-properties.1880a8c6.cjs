"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.PropertyKeys = PropertyKeys;exports.PropertyValues = PropertyValues;exports.RequiredArray = RequiredArray;
var _index = require("../../guard/index.mjs");
var _optional = require("./_optional.mjs"); // deno-fmt-ignore-file
/** Creates a RequiredArray derived from the given TProperties value. */
function RequiredArray(properties) {
  return _index.Guard.Keys(properties).filter((key) => !(0, _optional.IsOptional)(properties[key]));
}
/** Extracts a tuple of keys from a TProperties value. */
function PropertyKeys(properties) {
  return _index.Guard.Keys(properties);
}
/** Extracts a tuple of property values from a TProperties value. */
function PropertyValues(properties) {
  return _index.Guard.Values(properties);
} /* v9-40960557632efbbc */
