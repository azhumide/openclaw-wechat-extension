"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Evaluate = Evaluate;exports.EvaluateDeferred = EvaluateDeferred;
var _deferred = require("../types/deferred.mjs");
var _instantiate = require("../engine/evaluate/instantiate.mjs"); // deno-fmt-ignore-file
/** Creates a deferred Evaluate action. */
function EvaluateDeferred(type, options = {}) {
  return (0, _deferred.Deferred)('Evaluate', [type], options);
}
/** Applies an Evaluate action to a type. */
function Evaluate(type, options = {}) {
  return (0, _instantiate.EvaluateAction)(type, options);
} /* v9-44fd3e00cf8f8748 */
