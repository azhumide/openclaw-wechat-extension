"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromType = FromType;
var _array = require("../../types/array.mjs");
var _never = require("../../types/never.mjs");
var _object = require("../../types/object.mjs");
var _tuple = require("../../types/tuple.mjs");
var _from_array = require("./from_array.mjs");
var _from_object = require("./from_object.mjs");
var _from_tuple = require("./from_tuple.mjs"); // deno-fmt-ignore-file
function FromType(type, indexer) {
  return (0, _array.IsArray)(type) ? (0, _from_array.FromArray)(type.items, indexer) :
  (0, _object.IsObject)(type) ? (0, _from_object.FromObject)(type.properties, indexer) :
  (0, _tuple.IsTuple)(type) ? (0, _from_tuple.FromTuple)(type.items, indexer) :
  (0, _never.Never)();
} /* v9-553f97a3f7b54820 */
