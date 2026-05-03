"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Constructor = Constructor;exports.ConstructorOptions = ConstructorOptions;exports.IsConstructor = IsConstructor;
var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a Constructor type. */
function Constructor(parameters, instanceType, options = {}) {
  return _index.Memory.Create({ '~kind': 'Constructor' }, { type: 'constructor', parameters, instanceType }, options);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is a TConstructor. */
function IsConstructor(value) {
  return (0, _schema.IsKind)(value, 'Constructor');
}
// ------------------------------------------------------------------
// Options
// ------------------------------------------------------------------
/** Extracts options from a TConstructor. */
function ConstructorOptions(type) {
  return _index.Memory.Discard(type, ['~kind', 'type', 'parameters', 'instanceType']);
} /* v9-602da9d1bb00aa39 */
