"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.CallInstantiate = CallInstantiate;
var _index = require("../../../guard/index.mjs");
var _call = require("../../types/call.mjs");
var _ref = require("../../types/ref.mjs");
var _generic = require("../../types/generic.mjs");
var _index2 = require("../evaluate/index.mjs");
var _instantiate = require("../instantiate.mjs");




var _distribute_arguments = require("./distribute_arguments.mjs");
var _resolve_target = require("./resolve_target.mjs");
var _resolve_arguments = require("./resolve_arguments.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Infrastructure
// ------------------------------------------------------------------
function Peek(state) {const result = _index.Guard.IsGreaterThan(state.callstack.length, 0) ? state.callstack[state.callstack.length - 1] : '';return result;}
function IsTailCall(state, name) {
  const result = _index.Guard.IsEqual(Peek(state), name);
  return result;
}
function CallDispatch(context, state, target, parameters, expression, arguments_) {
  const argumentsContext = (0, _resolve_arguments.ResolveArgumentsContext)(context, state, parameters, arguments_);
  const returnType = (0, _instantiate.InstantiateType)(argumentsContext, { callstack: [...state.callstack, target.$ref] }, expression);
  return (0, _instantiate.InstantiateType)(context, state, returnType);
}
function CallDistributed(context, state, target, parameters, expression, distributedArguments) {
  return distributedArguments.reduce((result, arguments_) => [...result, CallDispatch(context, state, target, parameters, expression, arguments_)], []);
}
function CallImmediate(context, state, target, parameters, expression, arguments_) {
  const distributedArguments = (0, _distribute_arguments.DistributeArguments)(parameters, arguments_, expression);
  const returnTypes = CallDistributed(context, state, target, parameters, expression, distributedArguments);
  const result = _index.Guard.IsEqual(returnTypes.length, 1) ? returnTypes[0] : (0, _index2.EvaluateUnion)(returnTypes);
  return result;
}
function CallInstantiate(context, state, target, arguments_) {
  const instantiatedArguments = (0, _instantiate.InstantiateTypes)(context, state, arguments_);
  const resolved = (0, _resolve_target.ResolveTarget)(context, target, arguments_);
  const name = resolved[0];
  const type = resolved[1];
  const result = (0, _generic.IsGeneric)(type) ?
  IsTailCall(state, name) ?
  (0, _call.CallConstruct)((0, _ref.Ref)(name), instantiatedArguments) :
  CallImmediate(context, state, (0, _ref.Ref)(name), type.parameters, type.expression, instantiatedArguments) :
  (0, _call.CallConstruct)(target, instantiatedArguments);
  return result;
} /* v9-b2483a85e6864009 */
