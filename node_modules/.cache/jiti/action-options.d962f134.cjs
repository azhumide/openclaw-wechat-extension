"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Options = Options;exports.OptionsDeferred = OptionsDeferred;
var _deferred = require("../types/deferred.mjs");
var _instantiate = require("../engine/options/instantiate.mjs"); // deno-fmt-ignore-file
/** Creates a deferred Options action. */
function OptionsDeferred(type, options) {
  return (0, _deferred.Deferred)('Options', [type, options], {});
}
/** Applies an immediate Options action to the given type. */
function Options(type, options) {
  return (0, _instantiate.OptionsAction)(type, options);
} /* v9-60b8c20e50622e50 */
