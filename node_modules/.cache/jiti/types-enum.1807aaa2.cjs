"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Enum = Enum;exports.IsEnum = IsEnum;
var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs");
var _typescript_enum_to_enum_values = require("../engine/enum/typescript_enum_to_enum_values.mjs"); // deno-fmt-ignore-file

/** Creates an Enum type. */
function Enum(value, options) {
  const values = (0, _typescript_enum_to_enum_values.IsTypeScriptEnumLike)(value) ? (0, _typescript_enum_to_enum_values.TypeScriptEnumToEnumValues)(value) : value;
  return _index.Memory.Create({ '~kind': 'Enum' }, { enum: values }, options);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is a TEnum. */
function IsEnum(value) {
  return (0, _schema.IsKind)(value, 'Enum');
} /* v9-2a09d538982dd628 */
