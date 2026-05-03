"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.PartialAction = PartialAction;exports.PartialInstantiate = PartialInstantiate;
var _index = require("../../../system/memory/index.mjs");
var _partial = require("../../action/partial.mjs");
var _from_type = require("./from_type.mjs");
var _instantiate = require("../instantiate.mjs"); // deno-fmt-ignore-file
function PartialAction(type, options) {
  const result = (0, _instantiate.CanInstantiate)([type]) ?
  _index.Memory.Update((0, _from_type.FromType)(type), {}, options) :
  (0, _partial.PartialDeferred)(type, options);
  return result;
}
function PartialInstantiate(context, state, type, options) {
  const instantiatedType = (0, _instantiate.InstantiateType)(context, state, type);
  return PartialAction(instantiatedType, options);
} /* v9-f2310aa8e79690e8 */
