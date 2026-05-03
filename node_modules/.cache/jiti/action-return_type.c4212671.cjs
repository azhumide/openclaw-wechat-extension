"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ReturnType = ReturnType;exports.ReturnTypeDeferred = ReturnTypeDeferred;
var _deferred = require("../types/deferred.mjs");
var _instantiate = require("../engine/return_type/instantiate.mjs"); // deno-fmt-ignore-file
/** Creates a deferred ReturnType action. */
function ReturnTypeDeferred(type, options = {}) {
  return (0, _deferred.Deferred)('ReturnType', [type], options);
}
/** Applies a ReturnType action to the given type. */
function ReturnType(type, options = {}) {
  return (0, _instantiate.ReturnTypeAction)(type, options);
} /* v9-562deaccbd61dd76 */
