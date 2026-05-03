"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.CyclicTarget = CyclicTarget;
var _never = require("../../types/never.mjs");
var _ref = require("../../types/ref.mjs"); // deno-fmt-ignore-file
function Resolve(defs, ref) {
  return ref in defs ?
  (0, _ref.IsRef)(defs[ref])
  // @ts-ignore 5.0.4 - does not see $ref
  ? Resolve(defs, defs[ref].$ref) :
  defs[ref] :
  (0, _never.Never)();
}
/** Returns the target Type from the Defs or Never if target is non-resolvable */
function CyclicTarget(defs, ref) {
  const result = Resolve(defs, ref);
  return result;
} /* v9-a61941bb59b4941f */
