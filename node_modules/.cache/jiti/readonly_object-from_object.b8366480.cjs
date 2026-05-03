"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromObject = FromObject;
var _index = require("../../../guard/index.mjs");
var _object = require("../../types/object.mjs");
var _readonly = require("../../types/_readonly.mjs"); // deno-fmt-ignore-file
function FromObject(properties) {
  const mapped = _index.Guard.Keys(properties).reduce((result, left) => {
    return { ...result, [left]: (0, _readonly.Readonly)(properties[left]) };
  }, {});
  const result = (0, _object.Object)(mapped);
  return result;
} /* v9-87739a8bed659598 */
