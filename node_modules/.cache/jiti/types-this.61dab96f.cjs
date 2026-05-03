"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsThis = IsThis;exports.This = This;
var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a This type. */
function This(options) {
  return _index.Memory.Create({ ['~kind']: 'This' }, { $ref: '#' }, options);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is TThis. */
function IsThis(value) {
  return (0, _schema.IsKind)(value, 'This');
} /* v9-429a0b47ef544d81 */
