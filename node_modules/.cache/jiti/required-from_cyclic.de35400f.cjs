"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromCyclic = FromCyclic;
var _index = require("../../../system/memory/index.mjs");
var _cyclic = require("../../types/cyclic.mjs");
var _from_type = require("./from_type.mjs");
var _target = require("../cyclic/target.mjs"); // deno-fmt-ignore-file
function FromCyclic(defs, ref) {
  const target = (0, _target.CyclicTarget)(defs, ref);
  const partial = (0, _from_type.FromType)(target);
  const result = (0, _cyclic.Cyclic)(_index.Memory.Assign(defs, { [ref]: partial }), ref);
  return result;
} /* v9-1f26e88131d96ca4 */
