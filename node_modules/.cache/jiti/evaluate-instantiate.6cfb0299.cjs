"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.EvaluateAction = EvaluateAction;exports.EvaluateInstantiate = EvaluateInstantiate;
var _index = require("../../../system/memory/index.mjs");
var _instantiate = require("../instantiate.mjs");
var _evaluate = require("./evaluate.mjs"); // deno-fmt-ignore-file
function EvaluateAction(type, options) {
  const result = _index.Memory.Update((0, _evaluate.EvaluateType)(type), {}, options);
  return result;
}
function EvaluateInstantiate(context, state, type, options) {
  const instantiatedType = (0, _instantiate.InstantiateType)(context, state, type);
  return EvaluateAction(instantiatedType, options);
} /* v9-062b780850a845a5 */
