"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.BigInt = BigInt;exports.BigIntPattern = void 0;exports.IsBigInt = IsBigInt;
var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Pattern
// ------------------------------------------------------------------
const BigIntPattern = exports.BigIntPattern = '-?(?:0|[1-9][0-9]*)n';
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a BigInt type. */
function BigInt(options) {
  return _index.Memory.Create({ '~kind': 'BigInt' }, { type: 'bigint' }, options);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is a TBigInt. */
function IsBigInt(value) {
  return (0, _schema.IsKind)(value, 'BigInt');
} /* v9-481b7ae2868f5849 */
