"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ConstructorParameters = ConstructorParameters;exports.ConstructorParametersDeferred = ConstructorParametersDeferred;
var _deferred = require("../types/deferred.mjs");
var _instantiate = require("../engine/constructor_parameters/instantiate.mjs"); // deno-fmt-ignore-file
/** Creates a deferred ConstructorParameters action. */
function ConstructorParametersDeferred(type, options = {}) {
  return (0, _deferred.Deferred)('ConstructorParameters', [type], options);
}
/** Applies a ConstructorParameters action to a type. */
function ConstructorParameters(type, options = {}) {
  return (0, _instantiate.ConstructorParametersAction)(type, options);
} /* v9-e5b9872fa89c45d7 */
