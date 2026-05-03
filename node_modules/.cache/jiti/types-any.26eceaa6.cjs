"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Any = Any;exports.IsAny = IsAny;

var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
// deno-lint-ignore-file 
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a Any type. */function Any(options) {
  return _index.Memory.Create({ ['~kind']: 'Any' }, {}, options);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is a TAny. */
function IsAny(value) {
  return (0, _schema.IsKind)(value, 'Any');
} /* v9-fa04457801a1fbee */
