"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Lowercase = Lowercase;exports.LowercaseDeferred = LowercaseDeferred;
var _deferred = require("../types/deferred.mjs");
var _instantiate = require("../engine/intrinsics/instantiate.mjs"); // deno-fmt-ignore-file
/** Creates a deferred Lowercase action. */
function LowercaseDeferred(type, options = {}) {
  return (0, _deferred.Deferred)('Lowercase', [type], options);
}
/** Applies a Lowercase action to the given type. */
function Lowercase(type, options = {}) {
  return (0, _instantiate.LowercaseAction)(type, options);
} /* v9-6a4d0864fea1abd1 */
