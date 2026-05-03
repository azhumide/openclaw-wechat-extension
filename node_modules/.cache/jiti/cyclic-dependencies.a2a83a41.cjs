"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.CyclicDependencies = CyclicDependencies;
var _index = require("../../../system/unreachable/index.mjs");
var _array = require("../../types/array.mjs");
var _async_iterator = require("../../types/async_iterator.mjs");
var _constructor = require("../../types/constructor.mjs");
var _function = require("../../types/function.mjs");
var _intersect = require("../../types/intersect.mjs");
var _iterator = require("../../types/iterator.mjs");
var _object = require("../../types/object.mjs");
var _promise = require("../../types/promise.mjs");
var _properties = require("../../types/properties.mjs");
var _record = require("../../types/record.mjs");
var _tuple = require("../../types/tuple.mjs");
var _union = require("../../types/union.mjs");
var _ref = require("../../types/ref.mjs");
var _interface = require("../../action/interface.mjs"); // deno-fmt-ignore-file
function FromRef(context, ref, result) {
  return result.includes(ref) ?
  result :
  ref in context ?
  FromType(context, context[ref], [...result, ref]) :
  (0, _index.Unreachable)();
}
function FromProperties(context, properties, result) {
  const types = (0, _properties.PropertyValues)(properties);
  return FromTypes(context, types, result);
}
function FromTypes(context, types, result) {
  return types.reduce((result, left) => {
    return FromType(context, left, result);
  }, result);
}
function FromType(context, type, result) {
  return (0, _ref.IsRef)(type) ? FromRef(context, type.$ref, result) :
  (0, _array.IsArray)(type) ? FromType(context, type.items, result) :
  (0, _async_iterator.IsAsyncIterator)(type) ? FromType(context, type.iteratorItems, result) :
  (0, _constructor.IsConstructor)(type) ? FromTypes(context, [...type.parameters, type.instanceType], result) :
  (0, _function.IsFunction)(type) ? FromTypes(context, [...type.parameters, type.returnType], result) :
  (0, _interface.IsInterfaceDeferred)(type) ? FromProperties(context, type.parameters[1], result) :
  (0, _intersect.IsIntersect)(type) ? FromTypes(context, type.allOf, result) :
  (0, _iterator.IsIterator)(type) ? FromType(context, type.iteratorItems, result) :
  (0, _object.IsObject)(type) ? FromProperties(context, type.properties, result) :
  (0, _promise.IsPromise)(type) ? FromType(context, type.item, result) :
  (0, _union.IsUnion)(type) ? FromTypes(context, type.anyOf, result) :
  (0, _tuple.IsTuple)(type) ? FromTypes(context, type.items, result) :
  (0, _record.IsRecord)(type) ? FromType(context, (0, _record.RecordValue)(type), result) :
  result;
}
/** Returns dependent cyclic keys for the given type. This function is used to dead-type-eliminate (DTE) for initializing TCyclic types. */
function CyclicDependencies(context, key, type) {
  const result = FromType(context, type, [key]);
  return result;
} /* v9-cdab0ee0cbc239ad */
