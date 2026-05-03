"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Partial = Partial;exports.PartialDeferred = PartialDeferred;
var _deferred = require("../types/deferred.mjs");
var _instantiate = require("../engine/partial/instantiate.mjs"); // deno-fmt-ignore-file
/** Creates a deferred Partial action. */
function PartialDeferred(type, options = {}) {
  return (0, _deferred.Deferred)('Partial', [type], options);
}
/** Applies a Partial action to the given type. */
function Partial(type, options = {}) {
  return (0, _instantiate.PartialAction)(type, options);
} /* v9-b7d82ea2a787503a */
