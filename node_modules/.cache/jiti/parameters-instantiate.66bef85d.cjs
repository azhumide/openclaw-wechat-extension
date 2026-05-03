"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ParametersAction = ParametersAction;exports.ParametersInstantiate = ParametersInstantiate;

var _index = require("../../../system/memory/index.mjs");
var _function = require("../../types/function.mjs");
var _tuple = require("../../types/tuple.mjs");
var _parameters = require("../../action/parameters.mjs");
var _instantiate = require("../instantiate.mjs"); // deno-lint-ignore-file ban-types
// deno-fmt-ignore-file
function ParametersOperation(type) {
  const parameters = (0, _function.IsFunction)(type) ? type['parameters'] : [];
  const instantiatedParameters = (0, _instantiate.InstantiateElements)({}, { callstack: [] }, parameters);
  const result = (0, _tuple.Tuple)(instantiatedParameters);
  return result;
}
function ParametersAction(type, options) {
  const result = (0, _instantiate.CanInstantiate)([type]) ?
  _index.Memory.Update(ParametersOperation(type), {}, options) :
  (0, _parameters.ParametersDeferred)(type, options);
  return result;
}
function ParametersInstantiate(context, state, type, options) {
  const instantiatedType = (0, _instantiate.InstantiateType)(context, state, type);
  return ParametersAction(instantiatedType, options);
} /* v9-1129b03445e22904 */
