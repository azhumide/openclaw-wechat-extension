"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ExtendsFalse = ExtendsFalse;exports.ExtendsTrue = ExtendsTrue;exports.ExtendsUnion = ExtendsUnion;exports.IsExtendsFalse = IsExtendsFalse;exports.IsExtendsTrue = IsExtendsTrue;exports.IsExtendsTrueLike = IsExtendsTrueLike;exports.IsExtendsUnion = IsExtendsUnion;exports.Match = Match;var _index = require("../../guard/index.mjs");
var _index2 = require("../../system/memory/index.mjs");
function ExtendsUnion(inferred) {
  return _index2.Memory.Create({ ['~kind']: 'ExtendsUnion' }, { inferred });
}
function IsExtendsUnion(value) {
  return _index.Guard.IsObject(value) &&
  _index.Guard.HasPropertyKey(value, '~kind') &&
  _index.Guard.HasPropertyKey(value, 'inferred') &&
  _index.Guard.IsEqual(value['~kind'], 'ExtendsUnion') &&
  _index.Guard.IsObject(value.inferred);
}
function ExtendsTrue(inferred) {
  return _index2.Memory.Create({ ['~kind']: 'ExtendsTrue' }, { inferred });
}
function IsExtendsTrue(value) {
  return _index.Guard.IsObject(value) &&
  _index.Guard.HasPropertyKey(value, '~kind') &&
  _index.Guard.HasPropertyKey(value, 'inferred') &&
  _index.Guard.IsEqual(value['~kind'], 'ExtendsTrue') &&
  _index.Guard.IsObject(value.inferred);
}
function ExtendsFalse() {
  return _index2.Memory.Create({ ['~kind']: 'ExtendsFalse' }, {});
}
function IsExtendsFalse(value) {
  return _index.Guard.IsObject(value) &&
  _index.Guard.HasPropertyKey(value, '~kind') &&
  _index.Guard.IsEqual(value['~kind'], 'ExtendsFalse');
}
function IsExtendsTrueLike(value) {
  return IsExtendsUnion(value) || IsExtendsTrue(value);
}
function Match(result, true_, false_) {
  return IsExtendsTrueLike(result) ? true_(result.inferred) : false_();
} /* v9-ebaae712bfcc6555 */
