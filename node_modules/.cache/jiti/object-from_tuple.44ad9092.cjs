"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromTuple = FromTuple;
var _tuple = require("../../types/tuple.mjs");
var _to_object = require("../tuple/to_object.mjs");
var _from_type = require("./from_type.mjs"); // deno-fmt-ignore-file
function FromTuple(types) {
  const object = (0, _to_object.TupleToObject)((0, _tuple.Tuple)(types));
  const result = (0, _from_type.FromType)(object);
  return result;
} /* v9-8ca998d517b24a94 */
