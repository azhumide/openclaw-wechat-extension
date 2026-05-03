"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.RecordAction = RecordAction;exports.RecordInstantiate = RecordInstantiate;

var _index = require("../../../system/memory/index.mjs");
var _record = require("../../types/record.mjs");
var _from_key = require("./from_key.mjs");
var _instantiate = require("../instantiate.mjs"); // deno-fmt-ignore-file
// deno-lint-ignore-file
function RecordAction(key, value, options) {const result = (0, _instantiate.CanInstantiate)([key]) ?
  _index.Memory.Update((0, _from_key.FromKey)(key, value), {}, options) :
  (0, _record.RecordDeferred)(key, value, options);
  return result;
}
function RecordInstantiate(context, state, key, value, options) {
  const instantiatedKey = (0, _instantiate.InstantiateType)(context, state, key);
  const instantiatedValue = (0, _instantiate.InstantiateType)(context, state, value);
  return RecordAction(instantiatedKey, instantiatedValue, options);
} /* v9-ad9b9e59cfe17b2f */
