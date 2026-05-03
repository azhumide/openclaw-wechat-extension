"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Interface = Interface;exports.InterfaceDeferred = InterfaceDeferred;exports.IsInterfaceDeferred = IsInterfaceDeferred;
var _index = require("../../guard/index.mjs");
var _schema = require("../types/schema.mjs");
var _deferred = require("../types/deferred.mjs");
var _instantiate = require("../engine/interface/instantiate.mjs"); // deno-fmt-ignore-file
/** Creates a deferred Interface action. */
function InterfaceDeferred(heritage, properties, options = {}) {
  return (0, _deferred.Deferred)('Interface', [heritage, properties], options);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if this value is a deferred Interface action. */
function IsInterfaceDeferred(value) {
  return (0, _schema.IsSchema)(value) &&
  _index.Guard.HasPropertyKey(value, 'action') &&
  _index.Guard.IsEqual(value.action, 'Interface');
}
/** Creates an Interface using the given heritage and properties. */
function Interface(heritage, properties, options = {}) {
  return (0, _instantiate.InterfaceAction)(heritage, properties, options);
} /* v9-53fa0352539a4635 */
