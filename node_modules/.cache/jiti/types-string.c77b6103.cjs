"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsString = IsString;exports.String = String;exports.StringPattern = void 0;

var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-lint-ignore-file
// deno-fmt-ignore-file
// ------------------------------------------------------------------
// StringPattern
// ------------------------------------------------------------------
const StringPattern = exports.StringPattern = '.*'; // ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a String type. */
function String(options) {
  return _index.Memory.Create({ '~kind': 'String' }, { type: 'string' }, options);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is TString. */
function IsString(value) {
  return (0, _schema.IsKind)(value, 'String');
} /* v9-92198f3de19239eb */
