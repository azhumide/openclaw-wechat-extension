"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.NonNullableAction = NonNullableAction;exports.NonNullableInstantiate = NonNullableInstantiate;
var _index = require("../../../system/memory/index.mjs");
var _null = require("../../types/null.mjs");
var _undefined = require("../../types/undefined.mjs");
var _union = require("../../types/union.mjs");
var _instantiate = require("../exclude/instantiate.mjs");
var _non_nullable = require("../../action/non_nullable.mjs");
var _instantiate2 = require("../instantiate.mjs"); // deno-fmt-ignore-file
function NonNullableOperation(type) {
  const excluded = (0, _union.Union)([(0, _null.Null)(), (0, _undefined.Undefined)()]);
  return (0, _instantiate.ExcludeAction)(type, excluded, {});
}
function NonNullableAction(type, options) {
  const result = (0, _instantiate2.CanInstantiate)([type]) ?
  _index.Memory.Update(NonNullableOperation(type), {}, options) :
  (0, _non_nullable.NonNullableDeferred)(type, options);
  return result;
}
function NonNullableInstantiate(context, state, type, options) {
  const instantiatedType = (0, _instantiate2.InstantiateType)(context, state, type);
  return NonNullableAction(instantiatedType, options);
} /* v9-6a2f51d5e145693a */
