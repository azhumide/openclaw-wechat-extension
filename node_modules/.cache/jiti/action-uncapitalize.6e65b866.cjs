"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Uncapitalize = Uncapitalize;exports.UncapitalizeDeferred = UncapitalizeDeferred;
var _deferred = require("../types/deferred.mjs");
var _instantiate = require("../engine/intrinsics/instantiate.mjs"); // deno-fmt-ignore-file
/** Creates a deferred Uncapitalize action. */
function UncapitalizeDeferred(type, options = {}) {
  return (0, _deferred.Deferred)('Uncapitalize', [type], options);
}
/** Applies a Uncapitalize action to the given type. */
function Uncapitalize(type, options = {}) {
  return (0, _instantiate.UncapitalizeAction)(type, options);
} /* v9-6fb18caf909b72a7 */
