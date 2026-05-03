"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Capitalize = Capitalize;exports.CapitalizeDeferred = CapitalizeDeferred;
var _deferred = require("../types/deferred.mjs");
var _instantiate = require("../engine/intrinsics/instantiate.mjs"); // deno-fmt-ignore-file
/** Creates a deferred Capitalize action. */
function CapitalizeDeferred(type, options = {}) {
  return (0, _deferred.Deferred)('Capitalize', [type], options);
}
/** Applies a Capitalize action to the given type. */
function Capitalize(type, options = {}) {
  return (0, _instantiate.CapitalizeAction)(type, options);
} /* v9-5400ae031f41b903 */
