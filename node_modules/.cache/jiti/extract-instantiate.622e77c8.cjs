"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ExtractAction = ExtractAction;exports.ExtractInstantiate = ExtractInstantiate;
var _index = require("../../../system/memory/index.mjs");
var _instantiate = require("../instantiate.mjs");
var _extract = require("../../action/extract.mjs");
var _operation = require("./operation.mjs"); // deno-fmt-ignore-file
function ExtractAction(left, right, options) {
  const result = (0, _instantiate.CanInstantiate)([left, right]) ?
  _index.Memory.Update((0, _operation.ExtractOperation)(left, right), {}, options) :
  (0, _extract.ExtractDeferred)(left, right, options);
  return result;
}
function ExtractInstantiate(context, state, left, right, options) {
  const instantiatedLeft = (0, _instantiate.InstantiateType)(context, state, left);
  const instantiatedRight = (0, _instantiate.InstantiateType)(context, state, right);
  return ExtractAction(instantiatedLeft, instantiatedRight, options);
} /* v9-421fcb627f2ca543 */
