"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsUndefined = IsUndefined;exports.Undefined = Undefined;
var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a Undefined type. */
function Undefined(options) {
  return _index.Memory.Create({ '~kind': 'Undefined' }, { type: 'undefined' }, options);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is TUndefined. */
function IsUndefined(value) {
  return (0, _schema.IsKind)(value, 'Undefined');
} /* v9-c6c51aef7a154333 */
