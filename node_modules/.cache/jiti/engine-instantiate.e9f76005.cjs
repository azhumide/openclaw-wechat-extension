"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.CanInstantiate = CanInstantiate;exports.Instantiate = Instantiate;exports.InstantiateElements = InstantiateElements;exports.InstantiateProperties = InstantiateProperties;exports.InstantiateType = InstantiateType;exports.InstantiateTypes = InstantiateTypes;

var _index = require("../../guard/index.mjs");



var _immutable = require("../types/_immutable.mjs");
var _optional = require("../types/_optional.mjs");
var _readonly = require("../types/_readonly.mjs");



var _base = require("../types/base.mjs");
var _array = require("../types/array.mjs");
var _async_iterator = require("../types/async_iterator.mjs");
var _constructor = require("../types/constructor.mjs");
var _deferred = require("../types/deferred.mjs");
var _function = require("../types/function.mjs");
var _call = require("../types/call.mjs");
var _intersect = require("../types/intersect.mjs");
var _iterator = require("../types/iterator.mjs");
var _object = require("../types/object.mjs");
var _promise = require("../types/promise.mjs");
var _record = require("../types/record.mjs");
var _tuple = require("../types/tuple.mjs");
var _union = require("../types/union.mjs");
var _ref = require("../types/ref.mjs");
var _rest = require("../types/rest.mjs");



var _readonly2 = require("../action/_readonly.mjs");
var _optional2 = require("../action/_optional.mjs");



var _instantiate = require("./awaited/instantiate.mjs");
var _instantiate2 = require("./call/instantiate.mjs");
var _instantiate3 = require("./intrinsics/instantiate.mjs");
var _index2 = require("./conditional/index.mjs");
var _instantiate4 = require("./constructor_parameters/instantiate.mjs");
var _instantiate5 = require("./evaluate/instantiate.mjs");
var _instantiate6 = require("./exclude/instantiate.mjs");
var _instantiate7 = require("./extract/instantiate.mjs");
var _instantiate8 = require("./indexed/instantiate.mjs");
var _instantiate9 = require("./instance_type/instantiate.mjs");
var _instantiate0 = require("./interface/instantiate.mjs");
var _instantiate1 = require("./keyof/instantiate.mjs");

var _instantiate10 = require("./mapped/instantiate.mjs");
var _instantiate11 = require("./module/instantiate.mjs");
var _instantiate12 = require("./non_nullable/instantiate.mjs");
var _instantiate13 = require("./omit/instantiate.mjs");
var _instantiate14 = require("./options/instantiate.mjs");
var _instantiate15 = require("./parameters/instantiate.mjs");
var _instantiate16 = require("./partial/instantiate.mjs");
var _instantiate17 = require("./pick/instantiate.mjs");
var _instantiate18 = require("./readonly_object/instantiate.mjs");
var _instantiate19 = require("./record/instantiate.mjs");
var _instantiate20 = require("./ref/instantiate.mjs");
var _instantiate21 = require("./required/instantiate.mjs");
var _instantiate22 = require("./return_type/instantiate.mjs");
var _instantiate23 = require("./template_literal/instantiate.mjs");


var _index3 = require("./rest/index.mjs"); // deno-fmt-ignore-file
// deno-lint-ignore-file
// ------------------------------------------------------------------
// Modifiers
// ------------------------------------------------------------------
// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
// ------------------------------------------------------------------
// Modifier Actions
// ------------------------------------------------------------------
// ------------------------------------------------------------------
// Instantiate
// ------------------------------------------------------------------
function CanInstantiate(types) {return _index.Guard.TakeLeft(types, (left, right) => (0, _ref.IsRef)(left) ? false : CanInstantiate(right), () => true);}function ModifierActions(type, readonly, optional) {return (0, _readonly2.IsReadonlyRemoveAction)(type) ? ModifierActions(type.type, 'remove', optional) : (0, _optional2.IsOptionalRemoveAction)(type) ? ModifierActions(type.type, readonly, 'remove') : (0, _readonly2.IsReadonlyAddAction)(type) ? ModifierActions(type.type, 'add', optional) : (0, _optional2.IsOptionalAddAction)(type) ? ModifierActions(type.type, readonly, 'add') : [type, readonly, optional];}function ApplyReadonly(action, type) {return _index.Guard.IsEqual(action, 'remove') ? (0, _readonly.ReadonlyRemove)(type) :
  _index.Guard.IsEqual(action, 'add') ? (0, _readonly.ReadonlyAdd)(type) :
  type;
}
function ApplyOptional(action, type) {
  return _index.Guard.IsEqual(action, 'remove') ? (0, _optional.OptionalRemove)(type) :
  _index.Guard.IsEqual(action, 'add') ? (0, _optional.OptionalAdd)(type) :
  type;
}
function InstantiateProperties(context, state, properties) {
  return _index.Guard.Keys(properties).reduce((result, key) => {
    return { ...result, [key]: InstantiateType(context, state, properties[key]) };
  }, {});
}
function InstantiateElements(context, state, types) {
  const elements = InstantiateTypes(context, state, types);
  const result = (0, _index3.RestSpread)(elements);
  return result;
}
function InstantiateTypes(context, state, types) {
  return types.map((type) => InstantiateType(context, state, type));
}
function InstantiateDeferred(context, state, action, parameters, options) {
  return _index.Guard.IsEqual(action, 'Awaited') ? (0, _instantiate.AwaitedInstantiate)(context, state, parameters[0], options) :
  _index.Guard.IsEqual(action, 'Capitalize') ? (0, _instantiate3.CapitalizeInstantiate)(context, state, parameters[0], options) :
  _index.Guard.IsEqual(action, 'Conditional') ? (0, _index2.ConditionalInstantiate)(context, state, parameters[0], parameters[1], parameters[2], parameters[3], options) :
  _index.Guard.IsEqual(action, 'ConstructorParameters') ? (0, _instantiate4.ConstructorParametersInstantiate)(context, state, parameters[0], options) :
  _index.Guard.IsEqual(action, 'Evaluate') ? (0, _instantiate5.EvaluateInstantiate)(context, state, parameters[0], options) :
  _index.Guard.IsEqual(action, 'Exclude') ? (0, _instantiate6.ExcludeInstantiate)(context, state, parameters[0], parameters[1], options) :
  _index.Guard.IsEqual(action, 'Extract') ? (0, _instantiate7.ExtractInstantiate)(context, state, parameters[0], parameters[1], options) :
  _index.Guard.IsEqual(action, 'Index') ? (0, _instantiate8.IndexInstantiate)(context, state, parameters[0], parameters[1], options) :
  _index.Guard.IsEqual(action, 'InstanceType') ? (0, _instantiate9.InstanceTypeInstantiate)(context, state, parameters[0], options) :
  _index.Guard.IsEqual(action, 'Interface') ? (0, _instantiate0.InterfaceInstantiate)(context, state, parameters[0], parameters[1], options) :
  _index.Guard.IsEqual(action, 'KeyOf') ? (0, _instantiate1.KeyOfInstantiate)(context, state, parameters[0], options) :
  _index.Guard.IsEqual(action, 'Lowercase') ? (0, _instantiate3.LowercaseInstantiate)(context, state, parameters[0], options) :
  _index.Guard.IsEqual(action, 'Mapped') ? (0, _instantiate10.MappedInstantiate)(context, state, parameters[0], parameters[1], parameters[2], parameters[3], options) :
  _index.Guard.IsEqual(action, 'Module') ? (0, _instantiate11.ModuleInstantiate)(context, state, parameters[0], options) :
  _index.Guard.IsEqual(action, 'NonNullable') ? (0, _instantiate12.NonNullableInstantiate)(context, state, parameters[0], options) :
  _index.Guard.IsEqual(action, 'Pick') ? (0, _instantiate17.PickInstantiate)(context, state, parameters[0], parameters[1], options) :
  _index.Guard.IsEqual(action, 'Options') ? (0, _instantiate14.OptionsInstantiate)(context, state, parameters[0], parameters[1]) :
  _index.Guard.IsEqual(action, 'Parameters') ? (0, _instantiate15.ParametersInstantiate)(context, state, parameters[0], options) :
  _index.Guard.IsEqual(action, 'Partial') ? (0, _instantiate16.PartialInstantiate)(context, state, parameters[0], options) :
  _index.Guard.IsEqual(action, 'Omit') ? (0, _instantiate13.OmitInstantiate)(context, state, parameters[0], parameters[1], options) :
  _index.Guard.IsEqual(action, 'ReadonlyObject') ? (0, _instantiate18.ReadonlyObjectInstantiate)(context, state, parameters[0], options) :
  _index.Guard.IsEqual(action, 'Record') ? (0, _instantiate19.RecordInstantiate)(context, state, parameters[0], parameters[1], options) :
  _index.Guard.IsEqual(action, 'Required') ? (0, _instantiate21.RequiredInstantiate)(context, state, parameters[0], options) :
  _index.Guard.IsEqual(action, 'ReturnType') ? (0, _instantiate22.ReturnTypeInstantiate)(context, state, parameters[0], options) :
  _index.Guard.IsEqual(action, 'TemplateLiteral') ? (0, _instantiate23.TemplateLiteralInstantiate)(context, state, parameters[0], options) :
  _index.Guard.IsEqual(action, 'Uncapitalize') ? (0, _instantiate3.UncapitalizeInstantiate)(context, state, parameters[0], options) :
  _index.Guard.IsEqual(action, 'Uppercase') ? (0, _instantiate3.UppercaseInstantiate)(context, state, parameters[0], options) :
  (0, _deferred.Deferred)(action, parameters, options);
}
function InstantiateType(context, state, input) {
  const immutable = (0, _immutable.IsImmutable)(input);
  const modifiers = ModifierActions(input, (0, _readonly.IsReadonly)(input) ? 'add' : 'none', (0, _optional.IsOptional)(input) ? 'add' : 'none');
  const type = (0, _base.IsBase)(modifiers[0]) ? modifiers[0].Clone() : modifiers[0];
  const instantiated = (0, _ref.IsRef)(type) ? (0, _instantiate20.RefInstantiate)(context, state, type, type.$ref) :
  (0, _array.IsArray)(type) ? (0, _array._Array_)(InstantiateType(context, state, type.items), (0, _array.ArrayOptions)(type)) :
  (0, _async_iterator.IsAsyncIterator)(type) ? (0, _async_iterator.AsyncIterator)(InstantiateType(context, state, type.iteratorItems), (0, _async_iterator.AsyncIteratorOptions)(type)) :
  (0, _call.IsCall)(type) ? (0, _instantiate2.CallInstantiate)(context, state, type.target, type.arguments) :
  (0, _constructor.IsConstructor)(type) ? (0, _constructor.Constructor)(InstantiateTypes(context, state, type.parameters), InstantiateType(context, state, type.instanceType), (0, _constructor.ConstructorOptions)(type)) :
  (0, _deferred.IsDeferred)(type) ? InstantiateDeferred(context, state, type.action, type.parameters, type.options) :
  (0, _function.IsFunction)(type) ? (0, _function._Function_)(InstantiateTypes(context, state, type.parameters), InstantiateType(context, state, type.returnType), (0, _function.FunctionOptions)(type)) :
  (0, _intersect.IsIntersect)(type) ? (0, _intersect.Intersect)(InstantiateTypes(context, state, type.allOf), (0, _intersect.IntersectOptions)(type)) :
  (0, _iterator.IsIterator)(type) ? (0, _iterator.Iterator)(InstantiateType(context, state, type.iteratorItems), (0, _iterator.IteratorOptions)(type)) :
  (0, _object.IsObject)(type) ? (0, _object.Object)(InstantiateProperties(context, state, type.properties), (0, _object.ObjectOptions)(type)) :
  (0, _promise.IsPromise)(type) ? (0, _promise._Promise_)(InstantiateType(context, state, type.item), (0, _promise.PromiseOptions)(type)) :
  (0, _record.IsRecord)(type) ? (0, _record.RecordFromPattern)((0, _record.RecordPattern)(type), InstantiateType(context, state, (0, _record.RecordValue)(type))) :
  (0, _rest.IsRest)(type) ? (0, _rest.Rest)(InstantiateType(context, state, type.items)) :
  (0, _tuple.IsTuple)(type) ? (0, _tuple.Tuple)(InstantiateElements(context, state, type.items), (0, _tuple.TupleOptions)(type)) :
  (0, _union.IsUnion)(type) ? (0, _union.Union)(InstantiateTypes(context, state, type.anyOf), (0, _union.UnionOptions)(type)) :
  type;
  const withImmutable = immutable ? (0, _immutable.Immutable)(instantiated) : instantiated;
  const withModifiers = ApplyReadonly(modifiers[1], ApplyOptional(modifiers[2], withImmutable));
  return withModifiers;
}
/** Instantiates computed schematics using the given context and type. */
function Instantiate(context, type) {
  return InstantiateType(context, { callstack: [] }, type);
} /* v9-079cb9b344f726be */
