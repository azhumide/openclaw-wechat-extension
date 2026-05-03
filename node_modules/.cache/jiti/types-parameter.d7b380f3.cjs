"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsParameter = IsParameter;exports.Parameter = Parameter;
var _index = require("../../system/arguments/index.mjs");
var _index2 = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs");
var _unknown = require("./unknown.mjs"); // deno-fmt-ignore-file
/** Creates a Parameter type. */
function Parameter(...args) {
  const [name, extends_, equals] = _index.Arguments.Match(args, {
    3: (name, extends_, equals) => [name, extends_, equals],
    2: (name, extends_) => [name, extends_, extends_],
    1: (name) => [name, (0, _unknown.Unknown)(), (0, _unknown.Unknown)()]
  });
  return _index2.Memory.Create({ '~kind': 'Parameter' }, { name, extends: extends_, equals }, {});
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is TParameter. */
function IsParameter(value) {
  return (0, _schema.IsKind)(value, 'Parameter');
} /* v9-8222fe552ec74360 */
