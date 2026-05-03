"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromType = FromType;

var _cyclic = require("../../types/cyclic.mjs");
var _intersect = require("../../types/intersect.mjs");
var _object = require("../../types/object.mjs");
var _tuple = require("../../types/tuple.mjs");
var _union = require("../../types/union.mjs");
var _from_cyclic = require("./from_cyclic.mjs");
var _from_intersect = require("./from_intersect.mjs");
var _from_object = require("./from_object.mjs");
var _from_tuple = require("./from_tuple.mjs");
var _from_union = require("./from_union.mjs"); // deno-lint-ignore-file ban-types
// deno-fmt-ignore-file
function FromType(type) {return (0, _cyclic.IsCyclic)(type) ? (0, _from_cyclic.FromCyclic)(type.$defs, type.$ref) :
  (0, _intersect.IsIntersect)(type) ? (0, _from_intersect.FromIntersect)(type.allOf) :
  (0, _union.IsUnion)(type) ? (0, _from_union.FromUnion)(type.anyOf) :
  (0, _tuple.IsTuple)(type) ? (0, _from_tuple.FromTuple)(type.items) :
  (0, _object.IsObject)(type) ? (0, _from_object.FromObject)(type.properties) :
  {};
} /* v9-b58c153c48c5c8f2 */
