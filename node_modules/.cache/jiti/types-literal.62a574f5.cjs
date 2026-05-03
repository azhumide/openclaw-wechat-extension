"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.InvalidLiteralValue = void 0;exports.IsLiteral = IsLiteral;exports.IsLiteralBigInt = IsLiteralBigInt;exports.IsLiteralBoolean = IsLiteralBoolean;exports.IsLiteralNumber = IsLiteralNumber;exports.IsLiteralString = IsLiteralString;exports.IsLiteralValue = IsLiteralValue;exports.Literal = Literal;exports.LiteralTypeName = LiteralTypeName;
var _index = require("../../system/memory/index.mjs");
var _index2 = require("../../guard/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// InvalidLiteralValue
// ------------------------------------------------------------------
class InvalidLiteralValue extends Error {
  constructor(value) {
    super(`Invalid Literal value`);
    Object.defineProperty(this, 'cause', {
      value: { value },
      writable: false,
      configurable: false,
      enumerable: false
    });
  }
}exports.InvalidLiteralValue = InvalidLiteralValue;
function LiteralTypeName(value) {
  return _index2.Guard.IsBigInt(value) ? 'bigint' :
  _index2.Guard.IsBoolean(value) ? 'boolean' :
  _index2.Guard.IsNumber(value) ? 'number' :
  _index2.Guard.IsString(value) ? 'string' :
  (() => {throw new InvalidLiteralValue(value);})();
}
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a Literal type. */
function Literal(value, options) {
  return _index.Memory.Create({ '~kind': 'Literal' }, { type: LiteralTypeName(value), const: value }, options);
}
// ------------------------------------------------------------------
// Guards
// ------------------------------------------------------------------
/** Returns true if the given value is a TLiteralValue. */
function IsLiteralValue(value) {
  return _index2.Guard.IsBigInt(value) ||
  _index2.Guard.IsBoolean(value) ||
  _index2.Guard.IsNumber(value) ||
  _index2.Guard.IsString(value);
}
/** Returns true if the given value is TLiteral<bigint>. */
function IsLiteralBigInt(value) {
  return IsLiteral(value) && _index2.Guard.IsBigInt(value.const);
}
/** Returns true if the given value is TLiteral<boolean>. */
function IsLiteralBoolean(value) {
  return IsLiteral(value) && _index2.Guard.IsBoolean(value.const);
}
/** Returns true if the given value is TLiteral<number>. */
function IsLiteralNumber(value) {
  return IsLiteral(value) && _index2.Guard.IsNumber(value.const);
}
/** Returns true if the given value is TLiteral<string>. */
function IsLiteralString(value) {
  return IsLiteral(value) && _index2.Guard.IsString(value.const);
}
/** Returns true if the given value is TLiteral. */
function IsLiteral(value) {
  return (0, _schema.IsKind)(value, 'Literal');
} /* v9-30737602063092f1 */
