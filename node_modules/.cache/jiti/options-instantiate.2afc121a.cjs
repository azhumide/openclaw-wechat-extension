"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.OptionsAction = OptionsAction;exports.OptionsInstantiate = OptionsInstantiate;
var _index = require("../../../system/memory/index.mjs");
var _instantiate = require("../instantiate.mjs");
var _options = require("../../action/options.mjs"); // deno-fmt-ignore-file
function OptionsAction(type, options) {
  const result = (0, _instantiate.CanInstantiate)([type]) ?
  _index.Memory.Update(type, {}, options) :
  (0, _options.OptionsDeferred)(type, options);
  return result;
}
function OptionsInstantiate(context, state, type, options) {
  const instaniatedType = (0, _instantiate.InstantiateType)(context, state, type);
  return OptionsAction(instaniatedType, options);
} /* v9-c599edb48b001084 */
