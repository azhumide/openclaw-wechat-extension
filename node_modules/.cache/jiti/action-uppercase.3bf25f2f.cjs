"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Uppercase = Uppercase;exports.UppercaseDeferred = UppercaseDeferred;
var _deferred = require("../types/deferred.mjs");
var _instantiate = require("../engine/intrinsics/instantiate.mjs"); // deno-fmt-ignore-file
/** Creates a deferred Uppercase action. */
function UppercaseDeferred(type, options = {}) {
  return (0, _deferred.Deferred)('Uppercase', [type], options);
}
/** Applies a Uppercase action to the given type. */
function Uppercase(type, options = {}) {
  return (0, _instantiate.UppercaseAction)(type, options);
} /* v9-6d3417100957ef74 */
