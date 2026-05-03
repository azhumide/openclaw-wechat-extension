"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.RefInstantiate = RefInstantiate;
var _instantiate = require("../instantiate.mjs");
var _check = require("../cyclic/check.mjs"); // deno-fmt-ignore-file
function RefInstantiate(context, state, type, ref) {
  return ref in context ?
  (0, _check.CyclicCheck)([ref], context, context[ref]) ?
  type :
  (0, _instantiate.InstantiateType)(context, state, context[ref]) :
  type;
} /* v9-f6e36c8bfbf9b356 */
