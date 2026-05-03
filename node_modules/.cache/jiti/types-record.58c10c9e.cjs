"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IntegerKey = void 0;exports.IsRecord = IsRecord;exports.NumberKey = void 0;exports.Record = Record;exports.RecordDeferred = RecordDeferred;exports.RecordFromPattern = RecordFromPattern;exports.RecordKey = RecordKey;exports.RecordOptions = RecordOptions;exports.RecordPattern = RecordPattern;exports.RecordValue = RecordValue;exports.StringKey = void 0;
var _index = require("../../system/memory/index.mjs");
var _index2 = require("../../guard/index.mjs");
var _schema = require("./schema.mjs");
var _integer = require("./integer.mjs");
var _number = require("./number.mjs");
var _string = require("./string.mjs");
var _deferred = require("./deferred.mjs");
var _decode = require("../engine/template_literal/decode.mjs");
var _record_create = require("../engine/record/record_create.mjs");
var _instantiate = require("../engine/record/instantiate.mjs"); // deno-fmt-ignore-file
const IntegerKey = exports.IntegerKey = `^${_integer.IntegerPattern}$`;
const NumberKey = exports.NumberKey = `^${_number.NumberPattern}$`;
const StringKey = exports.StringKey = `^${_string.StringPattern}$`;
/** Represents a deferred Record action. */
function RecordDeferred(key, value, options = {}) {
  return (0, _deferred.Deferred)('Record', [key, value], options);
}
// -------------------------------------------------------------------
// Factory
// -------------------------------------------------------------------
/** Creates a Record type. */
function Record(key, value, options = {}) {
  return (0, _instantiate.RecordAction)(key, value, options);
}
// -------------------------------------------------------------------
// FromPattern
// -------------------------------------------------------------------
/** Creates a Record type from regular expression pattern. */
function RecordFromPattern(key, value) {
  return (0, _record_create.CreateRecord)(key, value);
}
/** Returns the raw string pattern used for the Record key  */
function RecordPattern(type) {
  return _index2.Guard.Keys(type.patternProperties)[0];
}
/** Returns the Record key as a TypeBox type  */
function RecordKey(type) {
  const pattern = RecordPattern(type);
  const result = _index2.Guard.IsEqual(pattern, StringKey) ? (0, _string.String)() :
  _index2.Guard.IsEqual(pattern, IntegerKey) ? (0, _integer.Integer)() :
  _index2.Guard.IsEqual(pattern, NumberKey) ? (0, _number.Number)() :
  (0, _decode.TemplateLiteralDecodeUnsafe)(pattern);
  return result;
}
function RecordValue(type) {
  return type.patternProperties[RecordPattern(type)];
}
// -------------------------------------------------------------------
// Guard
// -------------------------------------------------------------------
function IsRecord(value) {
  return (0, _schema.IsKind)(value, 'Record');
}
// -------------------------------------------------------------------
// Options
// -------------------------------------------------------------------
function RecordOptions(type) {
  return _index.Memory.Discard(type, ['~kind', 'type', 'patternProperties']);
} /* v9-3ebf3be8709cb48f */
