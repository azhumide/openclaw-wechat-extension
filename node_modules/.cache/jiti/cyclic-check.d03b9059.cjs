"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.CyclicCheck = CyclicCheck;
var _index = require("../../../guard/index.mjs");
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
function FromRef(stack, context, ref) {
  return stack.includes(ref) ?
  true :
  FromType([...stack, ref], context, context[ref]);
}
function FromProperties(stack, context, properties) {
  const types = (0, _properties.PropertyValues)(properties);
  return FromTypes(stack, context, types);
}
function FromTypes(stack, context, types) {
  return _index.Guard.TakeLeft(types, (left, right) => FromType(stack, context, left) ?
  true :
  FromTypes(stack, context, right), () => false);
}
function FromType(stack, context, type) {
  return (0, _ref.IsRef)(type) ? FromRef(stack, context, type.$ref) :
  (0, _array.IsArray)(type) ? FromType(stack, context, type.items) :
  (0, _async_iterator.IsAsyncIterator)(type) ? FromType(stack, context, type.iteratorItems) :
  (0, _constructor.IsConstructor)(type) ? FromTypes(stack, context, [...type.parameters, type.instanceType]) :
  (0, _function.IsFunction)(type) ? FromTypes(stack, context, [...type.parameters, type.returnType]) :
  (0, _interface.IsInterfaceDeferred)(type) ? FromProperties(stack, context, type.parameters[1]) :
  (0, _intersect.IsIntersect)(type) ? FromTypes(stack, context, type.allOf) :
  (0, _iterator.IsIterator)(type) ? FromType(stack, context, type.iteratorItems) :
  (0, _object.IsObject)(type) ? FromProperties(stack, context, type.properties) :
  (0, _promise.IsPromise)(type) ? FromType(stack, context, type.item) :
  (0, _union.IsUnion)(type) ? FromTypes(stack, context, type.anyOf) :
  (0, _tuple.IsTuple)(type) ? FromTypes(stack, context, type.items) :
  (0, _record.IsRecord)(type) ? FromType(stack, context, (0, _record.RecordValue)(type)) :
  false;
}
/** Performs a cyclic check on the given type. Initial key stack can be empty, but faster if specified */
function CyclicCheck(stack, context, type) {
  const result = FromType(stack, context, type);
  return result;
} /* v9-1ea6372d259c6c11 */
