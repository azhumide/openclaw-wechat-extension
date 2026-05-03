"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsVoid = IsVoid;exports.Void = Void;
var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a Void type. */
function Void(options) {
  return _index.Memory.Create({ '~kind': 'Void' }, { type: 'void' }, options);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is TVoid. */
function IsVoid(value) {
  return (0, _schema.IsKind)(value, 'Void');
} /* v9-1f00f8ed21c9dea8 */
