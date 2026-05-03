"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Extract = Extract;exports.ExtractDeferred = ExtractDeferred;
var _deferred = require("../types/deferred.mjs");
var _instantiate = require("../engine/extract/instantiate.mjs"); // deno-fmt-ignore-file
/** Creates a deferred Extract action. */
function ExtractDeferred(left, right, options = {}) {
  return (0, _deferred.Deferred)('Extract', [left, right], options);
}
/** Applies an Extract action using the given types. */
function Extract(left, right, options = {}) {
  return (0, _instantiate.ExtractAction)(left, right, options);
} /* v9-5d07871e5717874f */
