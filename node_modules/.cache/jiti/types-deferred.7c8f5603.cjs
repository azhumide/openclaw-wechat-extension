"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Deferred = Deferred;exports.IsDeferred = IsDeferred;var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs");
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a Deferred action. */
function Deferred(action, parameters, options) {
  return _index.Memory.Create({ '~kind': 'Deferred' }, { action, parameters, options }, {});
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is a TDeferred. */
function IsDeferred(value) {
  return (0, _schema.IsKind)(value, 'Deferred');
} /* v9-0f26a06283a698c9 */
