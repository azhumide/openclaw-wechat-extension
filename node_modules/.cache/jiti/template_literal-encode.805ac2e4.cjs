"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.TemplateLiteralEncode = TemplateLiteralEncode;
var _index = require("../../../guard/index.mjs");
var _enum = require("../../types/enum.mjs");
var _literal = require("../../types/literal.mjs");
var _union = require("../../types/union.mjs");
var _template_literal = require("../../types/template_literal.mjs");
var _bigint = require("../../types/bigint.mjs");
var _string = require("../../types/string.mjs");
var _number = require("../../types/number.mjs");
var _integer = require("../../types/integer.mjs");
var _boolean = require("../../types/boolean.mjs");
var _never = require("../../types/never.mjs");
var _create = require("./create.mjs");
var _enum_to_union = require("../enum/enum_to_union.mjs");
var _instantiate = require("./instantiate.mjs"); // deno-fmt-ignore-file
function JoinString(input) {
  return input.join('|');
}
function UnwrapTemplateLiteralPattern(pattern) {
  return pattern.slice(1, pattern.length - 1);
}
function EncodeLiteral(value, right, pattern) {
  return EncodeTypes(right, `${pattern}${value}`);
}
function EncodeBigInt(right, pattern) {
  return EncodeTypes(right, `${pattern}${_bigint.BigIntPattern}`);
}
function EncodeInteger(right, pattern) {
  return EncodeTypes(right, `${pattern}${_integer.IntegerPattern}`);
}
function EncodeNumber(right, pattern) {
  return EncodeTypes(right, `${pattern}${_number.NumberPattern}`);
}
function EncodeBoolean(right, pattern) {
  return EncodeType((0, _union.Union)([(0, _literal.Literal)('false'), (0, _literal.Literal)('true')]), right, pattern);
}
function EncodeString(right, pattern) {
  return EncodeTypes(right, `${pattern}${_string.StringPattern}`);
}
function EncodeTemplateLiteral(templatePattern, right, pattern) {
  return EncodeTypes(right, `${pattern}${UnwrapTemplateLiteralPattern(templatePattern)}`);
}
function EncodeTemplateLiteralDeferred(types, right, pattern) {
  const templateLiteral = (0, _instantiate.TemplateLiteralAction)(types, {});
  const result = EncodeType(templateLiteral, right, pattern);
  return result;
}
function EncodeEnum(types, right, pattern) {
  const variants = (0, _enum_to_union.EnumValuesToVariants)(types);
  return EncodeUnion(variants, right, pattern);
}
function EncodeUnion(types, right, pattern, result = []) {
  return _index.Guard.TakeLeft(types, (head, tail) => EncodeUnion(tail, right, pattern, [...result, EncodeType(head, [], '')]), () => EncodeTypes(right, `${pattern}(${JoinString(result)})`));
}
function EncodeType(type, right, pattern) {
  return (0, _enum.IsEnum)(type) ? EncodeEnum(type.enum, right, pattern) :
  (0, _integer.IsInteger)(type) ? EncodeInteger(right, pattern) :
  (0, _literal.IsLiteral)(type) ? EncodeLiteral(type.const, right, pattern) :
  (0, _bigint.IsBigInt)(type) ? EncodeBigInt(right, pattern) :
  (0, _boolean.IsBoolean)(type) ? EncodeBoolean(right, pattern) :
  (0, _number.IsNumber)(type) ? EncodeNumber(right, pattern) :
  (0, _string.IsString)(type) ? EncodeString(right, pattern) :
  (0, _template_literal.IsTemplateLiteral)(type) ? EncodeTemplateLiteral(type.pattern, right, pattern) :
  (0, _template_literal.IsTemplateLiteralDeferred)(type) ? EncodeTemplateLiteralDeferred(type.parameters[0], right, pattern) :
  (0, _union.IsUnion)(type) ? EncodeUnion(type.anyOf, right, pattern) :
  _never.NeverPattern;
}
function EncodeTypes(types, pattern) {
  return _index.Guard.TakeLeft(types, (left, right) => EncodeType(left, right, pattern), () => pattern);
}
function EncodePattern(types) {
  const encoded = EncodeTypes(types, '');
  const result = `^${encoded}$`;
  return result;
}
/** Encodes a TemplateLiteral type sequence into a TemplateLiteral */
function TemplateLiteralEncode(types) {
  const pattern = EncodePattern(types);
  const result = (0, _create.TemplateLiteralCreate)(pattern);
  return result;
} /* v9-c7d34d2e1f5bc510 */
