"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Parameters = Parameters;exports.ParametersDeferred = ParametersDeferred;
var _deferred = require("../types/deferred.mjs");
var _instantiate = require("../engine/parameters/instantiate.mjs"); // deno-fmt-ignore-file
/** Creates a deferred Parameters action. */
function ParametersDeferred(type, options = {}) {
  return (0, _deferred.Deferred)('Parameters', [type], options);
}
/** Applies a Parameters action to the given type. */
function Parameters(type, options = {}) {
  return (0, _instantiate.ParametersAction)(type, options);
} /* v9-efbe5eb695299060 */
