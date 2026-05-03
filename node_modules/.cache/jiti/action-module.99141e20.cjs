"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Module = Module;exports.ModuleDeferred = ModuleDeferred;

var _deferred = require("../types/deferred.mjs");
var _instantiate = require("../engine/instantiate.mjs"); // deno-lint-ignore-file ban-types
// deno-fmt-ignore-file
/** Creates a deferred Module action. */function ModuleDeferred(context, options = {}) {
  return (0, _deferred.Deferred)('Module', [context], options);
}
/** Applies a Module transformation action to the embedded property types. */
function Module(context, options = {}) {
  return (0, _instantiate.Instantiate)({}, ModuleDeferred(context, options));
} /* v9-c772045945a45387 */
