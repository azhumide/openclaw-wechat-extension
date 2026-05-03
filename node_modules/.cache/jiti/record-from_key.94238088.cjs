"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromKey = FromKey;

var _any = require("../../types/any.mjs");
var _boolean = require("../../types/boolean.mjs");
var _enum = require("../../types/enum.mjs");
var _intersect = require("../../types/intersect.mjs");
var _integer = require("../../types/integer.mjs");
var _literal = require("../../types/literal.mjs");
var _number = require("../../types/number.mjs");
var _object = require("../../types/object.mjs");
var _string = require("../../types/string.mjs");
var _template_literal = require("../../types/template_literal.mjs");
var _union = require("../../types/union.mjs");



var _from_key_any = require("./from_key_any.mjs");
var _from_key_boolean = require("./from_key_boolean.mjs");
var _from_key_enum = require("./from_key_enum.mjs");
var _from_key_integer = require("./from_key_integer.mjs");
var _from_key_intersect = require("./from_key_intersect.mjs");
var _from_key_literal = require("./from_key_literal.mjs");
var _from_key_number = require("./from_key_number.mjs");
var _from_key_string = require("./from_key_string.mjs");
var _from_key_template_literal = require("./from_key_template_literal.mjs");
var _from_key_union = require("./from_key_union.mjs"); // deno-fmt-ignore-file
// deno-lint-ignore-file
// ------------------------------------------------------------------
// Keys and Deferred
// ------------------------------------------------------------------
function FromKey(key, value) {const result = (0, _any.IsAny)(key) ? (0, _from_key_any.FromAnyKey)(value) : (0, _boolean.IsBoolean)(key) ? (0, _from_key_boolean.FromBooleanKey)(value) : (0, _enum.IsEnum)(key) ? (0, _from_key_enum.FromEnumKey)(key.enum, value) : (0, _integer.IsInteger)(key) ? (0, _from_key_integer.FromIntegerKey)(key, value) :
  (0, _intersect.IsIntersect)(key) ? (0, _from_key_intersect.FromIntersectKey)(key.allOf, value) :
  (0, _literal.IsLiteral)(key) ? (0, _from_key_literal.FromLiteralKey)(key.const, value) :
  (0, _number.IsNumber)(key) ? (0, _from_key_number.FromNumberKey)(key, value) :
  (0, _union.IsUnion)(key) ? (0, _from_key_union.FromUnionKey)(key.anyOf, value) :
  (0, _string.IsString)(key) ? (0, _from_key_string.FromStringKey)(key, value) :
  (0, _template_literal.IsTemplateLiteral)(key) ? (0, _from_key_template_literal.FromTemplateKey)(key.pattern, value) :
  (0, _object.Object)({});
  return result;
} /* v9-3fd1af0476c0e79f */
