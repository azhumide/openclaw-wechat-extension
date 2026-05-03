"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Call = Call;exports.CallConstruct = CallConstruct;exports.IsCall = IsCall;

var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs");
var _instantiate = require("../engine/call/instantiate.mjs"); // deno-lint-ignore-file ban-types
// deno-fmt-ignore-file
function CallConstruct(target, arguments_) {return _index.Memory.Create({ ['~kind']: 'Call' }, { target, arguments: arguments_ }, {});
}
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a Call type. */
function Call(target, arguments_) {
  return (0, _instantiate.CallInstantiate)({}, { callstack: [] }, target, arguments_);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given type is a TCall. */
function IsCall(value) {
  return (0, _schema.IsKind)(value, 'Call');
} /* v9-900a9fb999e081c4 */
