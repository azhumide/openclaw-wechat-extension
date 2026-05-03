"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Identifier = Identifier;exports.IsIdentifier = IsIdentifier;
var _index = require("../../system/memory/index.mjs");
var _schema = require("../types/schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates an Identifier. */
function Identifier(name) {
  return _index.Memory.Create({ '~kind': 'Identifier' }, { name });
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is a TIdentifier. */
function IsIdentifier(value) {
  return (0, _schema.IsKind)(value, 'Identifier');
} /* v9-6e3d82ae3e8a9ee9 */
