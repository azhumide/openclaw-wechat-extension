"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Awaited = Awaited;exports.AwaitedDeferred = AwaitedDeferred;
var _deferred = require("../types/deferred.mjs");
var _instantiate = require("../engine/awaited/instantiate.mjs"); // deno-fmt-ignore-file
/** Creates a deferred Awaited action. */
function AwaitedDeferred(type, options = {}) {
  return (0, _deferred.Deferred)('Awaited', [type], options);
}
/**
 * Applies an Awaited action to a type.
 *
 * @deprecated This action is being removed in the next version of TypeBox.
 */
function Awaited(type, options = {}) {
  return (0, _instantiate.AwaitedAction)(type, options);
} /* v9-d3ebe728fdc2a78c */
