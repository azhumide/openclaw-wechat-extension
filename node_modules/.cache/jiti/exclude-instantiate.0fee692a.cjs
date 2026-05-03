"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ExcludeAction = ExcludeAction;exports.ExcludeInstantiate = ExcludeInstantiate;
var _index = require("../../../system/memory/index.mjs");
var _instantiate = require("../instantiate.mjs");
var _exclude = require("../../action/exclude.mjs");
var _operation = require("./operation.mjs"); // deno-fmt-ignore-file
function ExcludeAction(left, right, options) {
  const result = (0, _instantiate.CanInstantiate)([left, right]) ?
  _index.Memory.Update((0, _operation.ExcludeOperation)(left, right), {}, options) :
  (0, _exclude.ExcludeDeferred)(left, right, options);
  return result;
}
function ExcludeInstantiate(context, state, left, right, options) {
  const instantiatedLeft = (0, _instantiate.InstantiateType)(context, state, left);
  const instantiatedRight = (0, _instantiate.InstantiateType)(context, state, right);
  return ExcludeAction(instantiatedLeft, instantiatedRight, options);
} /* v9-0a492ace71112d9d */
