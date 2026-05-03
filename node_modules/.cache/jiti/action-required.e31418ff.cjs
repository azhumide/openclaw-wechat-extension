"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Required = Required;exports.RequiredDeferred = RequiredDeferred;
var _deferred = require("../types/deferred.mjs");
var _instantiate = require("../engine/required/instantiate.mjs"); // deno-fmt-ignore-file
/** Creates a deferred Required action. */
function RequiredDeferred(type, options = {}) {
  return (0, _deferred.Deferred)('Required', [type], options);
}
/** Applies a Required action to the given type. */
function Required(type, options = {}) {
  return (0, _instantiate.RequiredAction)(type, options);
} /* v9-9d12698af51092ee */
