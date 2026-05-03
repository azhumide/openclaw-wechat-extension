"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.TemplateLiteralAction = TemplateLiteralAction;exports.TemplateLiteralInstantiate = TemplateLiteralInstantiate;
var _index = require("../../../system/memory/index.mjs");
var _template_literal = require("../../types/template_literal.mjs");
var _encode = require("./encode.mjs");
var _instantiate = require("../instantiate.mjs"); // deno-fmt-ignore-file
function TemplateLiteralAction(types, options) {
  const result = (0, _instantiate.CanInstantiate)(types) ?
  _index.Memory.Update((0, _encode.TemplateLiteralEncode)(types), {}, options) :
  (0, _template_literal.TemplateLiteralDeferred)(types, options);
  return result;
}
function TemplateLiteralInstantiate(context, state, types, options) {
  const instantiatedTypes = (0, _instantiate.InstantiateTypes)(context, state, types);
  return TemplateLiteralAction(instantiatedTypes, options);
} /* v9-4b5c6e8bf07d1237 */
