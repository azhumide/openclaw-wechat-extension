"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromType = FromType;
var _any = require("../../types/any.mjs");
var _array = require("../../types/array.mjs");
var _never = require("../../types/never.mjs");
var _object = require("../../types/object.mjs");
var _record = require("../../types/record.mjs");
var _tuple = require("../../types/tuple.mjs");



var _from_any = require("./from_any.mjs");
var _from_array = require("./from_array.mjs");
var _from_object = require("./from_object.mjs");
var _from_record = require("./from_record.mjs");
var _from_tuple = require("./from_tuple.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Computed
// ------------------------------------------------------------------
function FromType(type) {return (0, _any.IsAny)(type) ? (0, _from_any.FromAny)() : (0, _array.IsArray)(type) ? (0, _from_array.FromArray)(type.items) : (0, _object.IsObject)(type) ? (0, _from_object.FromObject)(type.properties) :
  (0, _record.IsRecord)(type) ? (0, _from_record.FromRecord)(type) :
  (0, _tuple.IsTuple)(type) ? (0, _from_tuple.FromTuple)(type.items) :
  (0, _never.Never)();
} /* v9-3f5892ffd4261904 */
