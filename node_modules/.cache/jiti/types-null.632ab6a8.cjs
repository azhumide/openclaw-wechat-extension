"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsNull = IsNull;exports.Null = Null;
var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a Null type. */
function Null(options) {
  return _index.Memory.Create({ '~kind': 'Null' }, { type: 'null' }, options);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is TNull. */
function IsNull(value) {
  return (0, _schema.IsKind)(value, 'Null');
} /* v9-261de93cfcc12c4c */
