"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsRefine = IsRefine;exports.IsRefinement = IsRefinement;exports.Refine = Refine;exports.RefineAdd = RefineAdd;
var _index = require("../../system/arguments/index.mjs");
var _index2 = require("../../system/memory/index.mjs");
var _index3 = require("../../guard/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
/** Applies a Refine check to the given type. */
function RefineAdd(type, refinement) {
  const refinements = IsRefine(type) ? [...type['~refine'], refinement] : [refinement];
  return _index2.Memory.Update(type, { '~refine': refinements }, {});
}
/** Refines a type with an explicit check */
function Refine(...args) {
  const [type, check, error_or_message] = _index.Arguments.Match(args, {
    3: (type, check, error) => [type, check, error],
    2: (type, check) => [type, check, () => 'Refine Error']
  });
  const error = _index3.Guard.IsString(error_or_message) ? () => error_or_message : error_or_message;
  return RefineAdd(type, { check, error });
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is a TRefinement. */
function IsRefinement(value) {
  return _index3.Guard.IsObjectNotArray(value) &&
  _index3.Guard.HasPropertyKey(value, 'check') &&
  _index3.Guard.HasPropertyKey(value, 'error') &&
  _index3.Guard.IsFunction(value.check) &&
  _index3.Guard.IsFunction(value.error);
}
/** Returns true if the given value is a TRefine. */
function IsRefine(value) {
  return (0, _schema.IsSchema)(value) &&
  _index3.Guard.HasPropertyKey(value, '~refine') &&
  _index3.Guard.IsArray(value['~refine']) &&
  _index3.Guard.Every(value['~refine'], 0, (value) => IsRefinement(value));
} /* v9-5fd2ecacb7f21fc0 */
