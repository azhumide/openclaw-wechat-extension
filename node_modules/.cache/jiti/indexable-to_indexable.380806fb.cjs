"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ToIndexable = ToIndexable;
var _index = require("../../../system/unreachable/index.mjs");
var _object = require("../../types/object.mjs");
var _index2 = require("../object/index.mjs"); // deno-fmt-ignore-file
// deno-coverage-ignore-start - symmetric unreachable
/** Transforms a type into a TProperties used for indexing operations */
function ToIndexable(type) {
  const collapsed = (0, _index2.CollapseToObject)(type);
  const result = (0, _object.IsObject)(collapsed) ?
  collapsed.properties :
  (0, _index.Unreachable)();
  return result;
}
// deno-coverage-ignore-stop /* v9-e49de196ffbf97c4 */
