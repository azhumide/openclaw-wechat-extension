"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.RequiredAction = RequiredAction;exports.RequiredInstantiate = RequiredInstantiate;
var _index = require("../../../system/memory/index.mjs");
var _from_type = require("./from_type.mjs");
var _required = require("../../action/required.mjs");
var _instantiate = require("../instantiate.mjs"); // deno-fmt-ignore-file
function RequiredAction(type, options) {
  const result = (0, _instantiate.CanInstantiate)([type]) ?
  _index.Memory.Update((0, _from_type.FromType)(type), {}, options) :
  (0, _required.RequiredDeferred)(type, options);
  return result;
}
function RequiredInstantiate(context, state, type, options) {
  const instaniatedType = (0, _instantiate.InstantiateType)(context, state, type);
  return RequiredAction(instaniatedType, options);
} /* v9-8285e8fc8cd7e1eb */
