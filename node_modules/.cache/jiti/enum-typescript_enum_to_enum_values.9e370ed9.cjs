"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsTypeScriptEnumLike = IsTypeScriptEnumLike;exports.TypeScriptEnumToEnumValues = TypeScriptEnumToEnumValues;
var _index = require("../../../guard/index.mjs"); // deno-fmt-ignore-file
function IsTypeScriptEnumLike(value) {
  return _index.Guard.IsObjectNotArray(value);
}
function TypeScriptEnumToEnumValues(type) {
  const keys = _index.Guard.Keys(type).filter((key) => isNaN(key));
  return keys.reduce((result, key) => [...result, type[key]], []);
} /* v9-a4285eaa01f3ea70 */
