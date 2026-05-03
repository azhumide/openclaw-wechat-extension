"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ConstructorParametersAction = ConstructorParametersAction;exports.ConstructorParametersInstantiate = ConstructorParametersInstantiate;

var _index = require("../../../system/memory/index.mjs");
var _constructor = require("../../types/constructor.mjs");
var _tuple = require("../../types/tuple.mjs");
var _constructor_parameters = require("../../action/constructor_parameters.mjs");
var _instantiate = require("../instantiate.mjs"); // deno-lint-ignore-file ban-types
// deno-fmt-ignore-file
function ConstructorParametersOperation(type) {
  const parameters = (0, _constructor.IsConstructor)(type) ? type['parameters'] : [];
  const instantiatedParameters = (0, _instantiate.InstantiateElements)({}, { callstack: [] }, parameters);
  const result = (0, _tuple.Tuple)(instantiatedParameters);
  return result;
}
function ConstructorParametersAction(type, options) {
  const result = (0, _instantiate.CanInstantiate)([type]) ?
  _index.Memory.Update(ConstructorParametersOperation(type), {}, options) :
  (0, _constructor_parameters.ConstructorParametersDeferred)(type, options);
  return result;
}
function ConstructorParametersInstantiate(context, state, type, options) {
  const instantiatedType = (0, _instantiate.InstantiateType)(context, state, type);
  return ConstructorParametersAction(instantiatedType, options);
} /* v9-283c06e5b7f3f11b */
