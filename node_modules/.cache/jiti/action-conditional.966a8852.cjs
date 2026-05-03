"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Conditional = Conditional;exports.ConditionalDeferred = ConditionalDeferred;

var _deferred = require("../types/deferred.mjs");
var _instantiate = require("../engine/conditional/instantiate.mjs"); // deno-lint-ignore-file ban-types
// deno-fmt-ignore-file
/** Creates a deferred Conditional action. */function ConditionalDeferred(left, right, true_, false_, options = {}) {
  return (0, _deferred.Deferred)('Conditional', [left, right, true_, false_], options);
}
/** Applies a Conditional action to the given types. */
function Conditional(left, right, true_, false_, options = {}) {
  return (0, _instantiate.ConditionalAction)({}, { callstack: [] }, left, right, true_, false_, options);
} /* v9-ba93dbac8b6728cf */
