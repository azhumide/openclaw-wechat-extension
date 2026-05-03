"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.CyclicCandidates = CyclicCandidates;
var _index = require("../../../system/unreachable/index.mjs");
var _properties = require("../../types/properties.mjs");
var _check = require("./check.mjs"); // deno-fmt-ignore-file
function ResolveCandidateKeys(context, keys) {
  return keys.reduce((result, left) => {
    return left in context ?
    (0, _check.CyclicCheck)([left], context, context[left]) ?
    [...result, left] :
    result :
    (0, _index.Unreachable)();
  }, []);
}
/** Returns keys for context types that need to be transformed to TCyclic. */
function CyclicCandidates(context) {
  const keys = (0, _properties.PropertyKeys)(context);
  const result = ResolveCandidateKeys(context, keys);
  return result;
} /* v9-cce234db69c76d34 */
