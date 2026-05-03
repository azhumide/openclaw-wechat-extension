"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsRest = IsRest;exports.Rest = Rest;
var _index = require("../../system/memory/index.mjs");
var _schema = require("../types/schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Type
// ------------------------------------------------------------------
/** Creates a Rest instruction type. */
function Rest(type) {
  return _index.Memory.Create({ '~kind': 'Rest' }, { type: 'rest', items: type }, {});
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is TRest. */
function IsRest(value) {
  return (0, _schema.IsKind)(value, 'Rest');
} /* v9-0d512359f64a18a4 */
