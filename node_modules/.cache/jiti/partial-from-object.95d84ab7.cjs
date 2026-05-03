"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromObject = FromObject;
var _index = require("../../../guard/index.mjs");
var _object = require("../../types/object.mjs");
var _optional = require("../../types/_optional.mjs"); // deno-fmt-ignore-file
function FromObject(properties) {
  const mapped = _index.Guard.Keys(properties).reduce((result, left) => {
    return { ...result, [left]: (0, _optional.Optional)(properties[left]) };
  }, {});
  const result = (0, _object.Object)(mapped);
  return result;
} /* v9-b91fa88ed0d48708 */
