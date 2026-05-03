"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Exclude = Exclude;exports.ExcludeDeferred = ExcludeDeferred;
var _deferred = require("../types/deferred.mjs");
var _instantiate = require("../engine/exclude/instantiate.mjs"); // deno-fmt-ignore-file
/** Creates a deferred Exclude action. */
function ExcludeDeferred(left, right, options = {}) {
  return (0, _deferred.Deferred)('Exclude', [left, right], options);
}
/** Applies a Exclude action using the given types */
function Exclude(left, right, options = {}) {
  return (0, _instantiate.ExcludeAction)(left, right, options);
} /* v9-d4f88b81b1f5cd4a */
