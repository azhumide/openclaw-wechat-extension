"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Infer = Infer;exports.IsInfer = IsInfer;
var _index = require("../../system/arguments/index.mjs");
var _index2 = require("../../system/memory/index.mjs");
var _schema = require("../types/schema.mjs");
var _unknown = require("../types/unknown.mjs"); // deno-fmt-ignore-file
/** Creates an Infer instruction. */
function Infer(...args) {
  const [name, extends_] = _index.Arguments.Match(args, {
    2: (name, extends_) => [name, extends_, extends_],
    1: (name) => [name, (0, _unknown.Unknown)(), (0, _unknown.Unknown)()]
  });
  return _index2.Memory.Create({ ['~kind']: 'Infer' }, { type: 'infer', name, extends: extends_ }, {});
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is TInfer. */
function IsInfer(value) {
  return (0, _schema.IsKind)(value, 'Infer');
} /* v9-3bfad1335461f4fb */
