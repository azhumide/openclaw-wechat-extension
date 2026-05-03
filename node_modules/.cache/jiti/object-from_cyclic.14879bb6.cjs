"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromCyclic = FromCyclic;
var _from_type = require("./from_type.mjs");
var _target = require("../cyclic/target.mjs"); // deno-fmt-ignore-file
function FromCyclic(defs, ref) {
  const target = (0, _target.CyclicTarget)(defs, ref);
  const result = (0, _from_type.FromType)(target);
  return result;
} /* v9-33fee9278cda1d12 */
