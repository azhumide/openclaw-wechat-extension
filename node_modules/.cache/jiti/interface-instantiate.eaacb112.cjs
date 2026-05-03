"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.InterfaceAction = InterfaceAction;exports.InterfaceInstantiate = InterfaceInstantiate;
var _index = require("../../../system/memory/index.mjs");
var _object = require("../../types/object.mjs");
var _evaluate = require("../evaluate/evaluate.mjs");
var _index2 = require("../../action/index.mjs");
var _instantiate = require("../instantiate.mjs"); // deno-fmt-ignore-file


function InterfaceOperation(heritage, properties) {
  const result = (0, _evaluate.EvaluateIntersect)([...heritage, (0, _object.Object)(properties)]);
  return result;
}
function InterfaceAction(heritage, properties, options) {
  const result = (0, _instantiate.CanInstantiate)(heritage) ?
  _index.Memory.Update(InterfaceOperation(heritage, properties), {}, options) :
  (0, _index2.InterfaceDeferred)(heritage, properties, options);
  return result;
}
function InterfaceInstantiate(context, state, heritage, properties, options) {
  const instantiatedHeritage = (0, _instantiate.InstantiateTypes)(context, state, heritage);
  const instantiatedProperties = (0, _instantiate.InstantiateProperties)(context, state, properties);
  return InterfaceAction(instantiatedHeritage, instantiatedProperties, options);
} /* v9-61f01d7a344a46fd */
