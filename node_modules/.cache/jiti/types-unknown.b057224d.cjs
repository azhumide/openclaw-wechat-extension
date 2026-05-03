"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsUnknown = IsUnknown;exports.Unknown = Unknown;
var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates an Unknown type. */
function Unknown(options) {
  return _index.Memory.Create({ ['~kind']: 'Unknown' }, {}, options);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is TUnknown. */
function IsUnknown(value) {
  return (0, _schema.IsKind)(value, 'Unknown');
} /* v9-3b649b151173b659 */
