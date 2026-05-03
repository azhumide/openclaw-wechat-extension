"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ModuleInstantiate = ModuleInstantiate;

var _index = require("../../../guard/index.mjs");
var _index2 = require("../../../system/memory/index.mjs");



var _candidates = require("../cyclic/candidates.mjs");
var _instantiate = require("../cyclic/instantiate.mjs");
var _instantiate2 = require("../instantiate.mjs"); // deno-lint-ignore-file ban-types
// deno-fmt-ignore-file
// ------------------------------------------------------------------
// Module: Instantiation Infrastructure
// ------------------------------------------------------------------
function InstantiateCyclics(context, cyclicKeys) {const keys = _index.Guard.Keys(context).filter((key) => cyclicKeys.includes(key));return keys.reduce((result, key) => {return { ...result, [key]: (0, _instantiate.InstantiateCyclic)(context, key, context[key]) };}, {});
}
function InstantiateNonCyclics(context, cyclicKeys) {
  const keys = _index.Guard.Keys(context).filter((key) => !cyclicKeys.includes(key));
  return keys.reduce((result, key) => {
    return { ...result, [key]: (0, _instantiate2.InstantiateType)(context, { callstack: [] }, context[key]) };
  }, {});
}
function InstantiateModule(context, options) {
  const cyclicCandidates = (0, _candidates.CyclicCandidates)(context);
  const instantiatedCyclics = InstantiateCyclics(context, cyclicCandidates);
  const instantiatedNonCyclics = InstantiateNonCyclics(context, cyclicCandidates);
  const instantiatedModule = { ...instantiatedCyclics, ...instantiatedNonCyclics };
  return _index2.Memory.Update(instantiatedModule, {}, options);
}
function ModuleInstantiate(context, _state, properties, options) {
  const moduleContext = _index2.Memory.Assign(context, properties);
  const instantiatedModule = InstantiateModule(moduleContext, options);
  return instantiatedModule;
} /* v9-e8436807d5a99bb1 */
