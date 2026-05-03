"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromUnionKey = FromUnionKey;

var _index = require("../../../guard/index.mjs");
var _schema = require("../../types/schema.mjs");
var _literal = require("../../types/literal.mjs");
var _number = require("../../types/number.mjs");
var _integer = require("../../types/integer.mjs");
var _object = require("../../types/object.mjs");
var _string = require("../../types/string.mjs");
var _record = require("../../types/record.mjs");
var _flatten = require("../evaluate/flatten.mjs");
var _record_create = require("./record_create.mjs"); // deno-fmt-ignore-file
// deno-lint-ignore-file
function StringOrNumberCheck(types) {return types.some((type) => (0, _string.IsString)(type) || (0, _number.IsNumber)(type) || (0, _integer.IsInteger)(type));
}
function TryBuildRecord(types, value) {
  return _index.Guard.IsEqual(StringOrNumberCheck(types), true) ?
  (0, _record_create.CreateRecord)(_record.StringKey, value) :
  undefined;
}
function CreateProperties(types, value) {
  return types.reduce((result, left) => {
    return (0, _literal.IsLiteral)(left) && (_index.Guard.IsString(left.const) || _index.Guard.IsNumber(left.const)) ?
    { ...result, [left.const]: value } :
    result;
  }, {});
}
function CreateObject(types, value) {
  const properties = CreateProperties(types, value);
  const result = (0, _object.Object)(properties);
  return result;
}
function FromUnionKey(types, value) {
  const flattened = (0, _flatten.Flatten)(types);
  const record = TryBuildRecord(flattened, value);
  return (0, _schema.IsSchema)(record) // maybe IsRecord?
  ? record :
  CreateObject(flattened, value);
} /* v9-da113234e71f9e42 */
