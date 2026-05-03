"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Boolean = Boolean;exports.IsBoolean = IsBoolean;
var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a Boolean type. */
function Boolean(options) {
  return _index.Memory.Create({ '~kind': 'Boolean' }, { type: 'boolean' }, options);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is a TBoolean. */
function IsBoolean(value) {
  return (0, _schema.IsKind)(value, 'Boolean');
} /* v9-8fb26e4f7632cde5 */
