"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ResolveArgumentsContext = ResolveArgumentsContext;
var _index = require("../../../guard/index.mjs");
var _index2 = require("../../../system/memory/index.mjs");
var _instantiate = require("../instantiate.mjs");
var _index3 = require("../../extends/index.mjs");
var _infer = require("../../types/infer.mjs");
var _call = require("../../types/call.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// AssertArgument
// ------------------------------------------------------------------
function AssertArgumentExtends(name, type, extends_) {
  if ((0, _infer.IsInfer)(type) || (0, _call.IsCall)(type) || _index3.ExtendsResult.IsExtendsTrueLike((0, _index3.Extends)({}, type, extends_)))
  return;
  const cause = { parameter: name, expect: extends_, actual: type };
  // @ts-ignore - no definition for { cause } options 
  throw new Error(`Argument for parameter ${name} does not satisfy constraint`, { cause });
}
function BindArgument(context, state, name, extends_, type) {
  const instantiatedArgument = (0, _instantiate.InstantiateType)(context, state, type);
  AssertArgumentExtends(name, instantiatedArgument, extends_);
  return _index2.Memory.Assign(context, { [name]: instantiatedArgument });
}
function BindArguments(context, state, parameterLeft, parameterRight, arguments_) {
  const instantiatedExtends = (0, _instantiate.InstantiateType)(context, state, parameterLeft.extends);
  const instantiatedEquals = (0, _instantiate.InstantiateType)(context, state, parameterLeft.equals);
  return _index.Guard.TakeLeft(arguments_, (left, right) => BindParameters(BindArgument(context, state, parameterLeft['name'], instantiatedExtends, left), state, parameterRight, right), () => BindParameters(BindArgument(context, state, parameterLeft['name'], instantiatedExtends, instantiatedEquals), state, parameterRight, []));
}
function BindParameters(context, state, parameters, arguments_) {
  return _index.Guard.TakeLeft(parameters, (left, right) => BindArguments(context, state, left, right, arguments_), () => context);
}
function ResolveArgumentsContext(context, state, parameters, arguments_) {
  return BindParameters(context, state, parameters, arguments_);
} /* v9-fb660897435cf9d2 */
