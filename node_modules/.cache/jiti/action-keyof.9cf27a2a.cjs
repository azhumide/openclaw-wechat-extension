"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.KeyOf = KeyOf;exports.KeyOfDeferred = KeyOfDeferred;
var _deferred = require("../types/deferred.mjs");
var _instantiate = require("../engine/keyof/instantiate.mjs"); // deno-fmt-ignore-file
/** Creates a deferred KeyOf action. */
function KeyOfDeferred(type, options = {}) {
  return (0, _deferred.Deferred)('KeyOf', [type], options);
}
/** Applies a KeyOf action to the given type. */
function KeyOf(type, options = {}) {
  return (0, _instantiate.KeyOfAction)(type, options);
} /* v9-855050770dcade25 */
