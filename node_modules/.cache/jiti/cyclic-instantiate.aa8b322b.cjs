"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.InstantiateCyclic = InstantiateCyclic;

var _index = require("../../../guard/index.mjs");
var _cyclic = require("../../types/cyclic.mjs");
var _object = require("../../types/object.mjs");
var _dependencies = require("../cyclic/dependencies.mjs");
var _index2 = require("../../action/index.mjs");
var _instantiate = require("../instantiate.mjs");

var _evaluate = require("../evaluate/evaluate.mjs"); // deno-lint-ignore-file ban-types
// deno-fmt-ignore-file
function CyclicInterface(context, heritage, properties) {const instantiatedHeritage = (0, _instantiate.InstantiateTypes)(context, { callstack: [] }, heritage);
  const instantiatedProperties = (0, _instantiate.InstantiateProperties)({}, { callstack: [] }, properties);
  const evaluatedInterface = (0, _evaluate.EvaluateIntersect)([...instantiatedHeritage, (0, _object.Object)(instantiatedProperties)]);
  return evaluatedInterface;
}
function CyclicDefinitions(context, dependencies) {
  const keys = _index.Guard.Keys(context).filter((key) => dependencies.includes(key));
  return keys.reduce((result, key) => {
    const type = context[key];
    const instantiatedType = (0, _index2.IsInterfaceDeferred)(type) ? CyclicInterface(context, type.parameters[0], type.parameters[1]) : type;
    return { ...result, [key]: instantiatedType };
  }, {});
}
function InstantiateCyclic(context, ref, type) {
  const dependencies = (0, _dependencies.CyclicDependencies)(context, ref, type);
  const definitions = CyclicDefinitions(context, dependencies);
  const result = (0, _cyclic.Cyclic)(definitions, ref);
  return result;
} /* v9-d401340d2a39ec9f */
