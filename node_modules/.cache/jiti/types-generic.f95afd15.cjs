"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Generic = Generic;exports.IsGeneric = IsGeneric;
var _index = require("../../system/memory/index.mjs");
var _schema = require("../types/schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Type
// ------------------------------------------------------------------
/** Creates a Generic type. */
function Generic(parameters, expression) {
  return _index.Memory.Create({ '~kind': 'Generic' }, { type: 'generic', parameters, expression });
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is a TGeneric. */
function IsGeneric(value) {
  return (0, _schema.IsKind)(value, 'Generic');
} /* v9-a078aa58e42eb881 */
