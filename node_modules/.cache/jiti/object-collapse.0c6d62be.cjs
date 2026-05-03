"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.CollapseToObject = CollapseToObject;
var _object = require("../../types/object.mjs");
var _from_type = require("./from_type.mjs"); // deno-fmt-ignore-file
/**
 * Collapses a type into a TObject schema. This is a lossy fast path used to
 * normalize arbitrary TSchema types into a TObject structure. This function is
 * primarily used in indexing operations where a normalized object structure
 * is required. If the type cannot be collapsed, an empty object schema is returned.
 */
function CollapseToObject(type) {
  const properties = (0, _from_type.FromType)(type);
  const result = (0, _object.Object)(properties);
  return result;
} /* v9-6c4f8b7a51353384 */
