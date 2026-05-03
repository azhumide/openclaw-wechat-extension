"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ResolveTarget = ResolveTarget;
var _generic = require("../../types/generic.mjs");
var _ref = require("../../types/ref.mjs");
var _never = require("../../types/never.mjs"); // deno-fmt-ignore-file
function FromNotResolvable() {
  return ['(not-resolvable)', (0, _never.Never)()];
}
function FromNotGeneric() {
  return ['(not-generic)', (0, _never.Never)()];
}
function FromGeneric(name, parameters, expression) {
  return [name, (0, _generic.Generic)(parameters, expression)];
}
function FromRef(context, ref, arguments_) {
  return ref in context ?
  FromType(context, ref, context[ref], arguments_) :
  FromNotResolvable();
}
function FromType(context, name, target, arguments_) {
  return (0, _generic.IsGeneric)(target) ? FromGeneric(name, target.parameters, target.expression) :
  (0, _ref.IsRef)(target) ? FromRef(context, target.$ref, arguments_) :
  FromNotGeneric();
}
/** Resolves a named generic target from the context, or returns TNever if it cannot be resolved or is not generic. */
function ResolveTarget(context, target, arguments_) {
  return FromType(context, '(anonymous)', target, arguments_);
} /* v9-2e805ee89c3a9f00 */
