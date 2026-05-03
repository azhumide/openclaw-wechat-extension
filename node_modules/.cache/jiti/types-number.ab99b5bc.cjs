"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsNumber = IsNumber;exports.Number = Number;exports.NumberPattern = void 0;
var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Pattern
// ------------------------------------------------------------------
const NumberPattern = exports.NumberPattern = '-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?';
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a Number type. */
function Number(options) {
  return _index.Memory.Create({ '~kind': 'Number' }, { type: 'number' }, options);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is a TNumber. */
function IsNumber(value) {
  return (0, _schema.IsKind)(value, 'Number');
} /* v9-3275fe7dccfcf5da */
