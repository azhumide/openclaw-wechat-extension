"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Mapped = Mapped;exports.MappedDeferred = MappedDeferred;

var _deferred = require("../types/deferred.mjs");
var _instantiate = require("../engine/mapped/instantiate.mjs"); // deno-lint-ignore-file ban-types
// deno-fmt-ignore-file
/** Creates a deferred Mapped action. */function MappedDeferred(identifier, type, as, property, options = {}) {
  return (0, _deferred.Deferred)('Mapped', [identifier, type, as, property], options);
}
/** Applies a Mapped action using the given types. */
function Mapped(identifier, type, as, property, options = {}) {
  return (0, _instantiate.MappedAction)({}, { callstack: [] }, identifier, type, as, property, options);
} /* v9-cf311da73e03a2af */
