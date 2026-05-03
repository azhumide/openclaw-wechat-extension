"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ReadonlyObjectAction = ReadonlyObjectAction;exports.ReadonlyObjectInstantiate = ReadonlyObjectInstantiate;
var _index = require("../../../system/memory/index.mjs");
var _readonly_object = require("../../action/readonly_object.mjs");
var _from_type = require("./from_type.mjs");
var _instantiate = require("../instantiate.mjs"); // deno-fmt-ignore-file
function ReadonlyObjectAction(type, options) {
  const result = (0, _instantiate.CanInstantiate)([type]) ?
  _index.Memory.Update((0, _from_type.FromType)(type), {}, options) :
  (0, _readonly_object.ReadonlyObjectDeferred)(type);
  return result;
}
function ReadonlyObjectInstantiate(context, state, type, options) {
  const instantiatedType = (0, _instantiate.InstantiateType)(context, state, type);
  return ReadonlyObjectAction(instantiatedType, options);
} /* v9-00204d5c7fcb60ce */
