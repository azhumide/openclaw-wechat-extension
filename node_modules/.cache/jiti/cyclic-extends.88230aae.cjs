"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.CyclicExtends = CyclicExtends;
var _index = require("../../../guard/index.mjs");
var _any = require("../../types/any.mjs");
var _array = require("../../types/array.mjs");
var _async_iterator = require("../../types/async_iterator.mjs");
var _constructor = require("../../types/constructor.mjs");
var _function = require("../../types/function.mjs");
var _intersect = require("../../types/intersect.mjs");
var _iterator = require("../../types/iterator.mjs");
var _object = require("../../types/object.mjs");
var _promise = require("../../types/promise.mjs");
var _record = require("../../types/record.mjs");
var _ref2 = require("../../types/ref.mjs");
var _tuple = require("../../types/tuple.mjs");
var _union = require("../../types/union.mjs");
var _unknown = require("../../types/unknown.mjs"); // deno-fmt-ignore-file
function FromRef(_ref) {
  return (0, _any.Any)();
}
function FromProperties(properties) {
  return _index.Guard.Keys(properties).reduce((result, key) => {
    return { ...result, [key]: FromType(properties[key]) };
  }, {});
}
function FromTypes(types) {
  return types.reduce((result, left) => {
    return [...result, FromType(left)];
  }, []);
}
function FromType(type) {
  return (0, _ref2.IsRef)(type) ? FromRef(type.$ref) :
  (0, _array.IsArray)(type) ? (0, _array.Array)(FromType(type.items), (0, _array.ArrayOptions)(type)) :
  (0, _async_iterator.IsAsyncIterator)(type) ? (0, _async_iterator.AsyncIterator)(FromType(type.iteratorItems)) :
  (0, _constructor.IsConstructor)(type) ? (0, _constructor.Constructor)(FromTypes(type.parameters), FromType(type.instanceType)) :
  (0, _function.IsFunction)(type) ? (0, _function.Function)(FromTypes(type.parameters), FromType(type.returnType)) :
  (0, _intersect.IsIntersect)(type) ? (0, _intersect.Intersect)(FromTypes(type.allOf)) :
  (0, _iterator.IsIterator)(type) ? (0, _iterator.Iterator)(FromType(type.iteratorItems)) :
  (0, _object.IsObject)(type) ? (0, _object.Object)(FromProperties(type.properties)) :
  (0, _promise.IsPromise)(type) ? (0, _promise.Promise)(FromType(type.item)) :
  (0, _record.IsRecord)(type) ? (0, _record.Record)((0, _record.RecordKey)(type), FromType((0, _record.RecordValue)(type))) :
  (0, _union.IsUnion)(type) ? (0, _union.Union)(FromTypes(type.anyOf)) :
  (0, _tuple.IsTuple)(type) ? (0, _tuple.Tuple)(FromTypes(type.items)) :
  type;
}
function CyclicAnyFromParameters(defs, ref) {
  return ref in defs ?
  FromType(defs[ref]) :
  (0, _unknown.Unknown)();
}
/** Transforms TCyclic TRef's into TAny's. This function is used prior to TExtends checks to enable cyclics to be structurally checked and terminated (with TAny) at first point of recursion, what would otherwise be a recursive TRef.*/
function CyclicExtends(type) {
  return CyclicAnyFromParameters(type.$defs, type.$ref);
} /* v9-f746907e57b203af */
