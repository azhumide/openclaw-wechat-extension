"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromBooleanKey = FromBooleanKey;
var _object = require("../../types/object.mjs"); // deno-fmt-ignore-file
function FromBooleanKey(value) {
  return (0, _object.Object)({ true: value, false: value });
} /* v9-1933597da49133a5 */
