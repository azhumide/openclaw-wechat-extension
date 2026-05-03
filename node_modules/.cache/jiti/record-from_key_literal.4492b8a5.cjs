"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromLiteralKey = FromLiteralKey;

var _index = require("../../../guard/index.mjs");
var _object = require("../../types/object.mjs"); // deno-fmt-ignore-file
// deno-lint-ignore-file
function FromLiteralKey(key, value) {return _index.Guard.IsString(key) || _index.Guard.IsNumber(key) ? (0, _object.Object)({ [key]: value }) :
  _index.Guard.IsEqual(key, false) ? (0, _object.Object)({ false: value }) :
  _index.Guard.IsEqual(key, true) ? (0, _object.Object)({ true: value }) :
  (0, _object.Object)({});
} /* v9-26d7acbb0a1145d4 */
