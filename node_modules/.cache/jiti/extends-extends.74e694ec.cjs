"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Extends = Extends;
var _cyclic = require("../types/cyclic.mjs");
var _unknown = require("../types/unknown.mjs");
var _unsafe = require("../types/unsafe.mjs");
var _extends_left = require("./extends_left.mjs");
var _index = require("../engine/cyclic/index.mjs"); // deno-fmt-ignore-file
function Canonical(type) {
  return (0, _cyclic.IsCyclic)(type) ? (0, _index.CyclicExtends)(type) :
  (0, _unsafe.IsUnsafe)(type) ? (0, _unknown.Unknown)() :
  type;
}
/** Performs a structural extends check on left and right types and yields inferred types on right if specified. */
function Extends(inferred, left, right) {
  const canonicalLeft = Canonical(left);
  const canonicalRight = Canonical(right);
  return (0, _extends_left.ExtendsLeft)(inferred, canonicalLeft, canonicalRight);
} /* v9-6bc1efc84a2d68cb */
