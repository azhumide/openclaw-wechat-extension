"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.InstanceType = InstanceType;exports.InstanceTypeDeferred = InstanceTypeDeferred;
var _deferred = require("../types/deferred.mjs");
var _instantiate = require("../engine/instance_type/instantiate.mjs"); // deno-fmt-ignore-file
/** Creates a deferred InstanceType action. */
function InstanceTypeDeferred(type, options = {}) {
  return (0, _deferred.Deferred)('InstanceType', [type], options);
}
/** Applies a InstanceType action to the given type. */
function InstanceType(type, options = {}) {
  return (0, _instantiate.InstanceTypeAction)(type, options);
} /* v9-0830d917d52a0abf */
