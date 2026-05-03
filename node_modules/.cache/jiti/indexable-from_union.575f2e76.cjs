"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromUnion = FromUnion;
var _from_type = require("./from_type.mjs"); // deno-fmt-ignore-file
function FromUnion(types) {
  return types.reduce((result, left) => {
    return [...result, ...(0, _from_type.FromType)(left)];
  }, []);
} /* v9-3897eb3cd3240c94 */
