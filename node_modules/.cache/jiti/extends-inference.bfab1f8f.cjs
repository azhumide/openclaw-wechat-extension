"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.InferTupleResult = InferTupleResult;exports.InferUnionResult = InferUnionResult;exports.Inferrable = Inferrable;exports.IsInferable = IsInferable;exports.TryInferable = TryInferable;exports.TryRestInferable = TryRestInferable;

var _index = require("../../system/unreachable/index.mjs");
var _index2 = require("../../system/memory/index.mjs");
var _index3 = require("../../guard/index.mjs");
var _array = require("../types/array.mjs");
var _unknown = require("../types/unknown.mjs");
var _tuple = require("../types/tuple.mjs");
var _extends_left = require("./extends_left.mjs");
var _union = require("../types/union.mjs");



var _infer = require("../types/infer.mjs");
var _rest = require("../types/rest.mjs");
var Result = _interopRequireWildcard(require("./result.mjs"));function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);} // deno-lint-ignore-file ban-types
// deno-fmt-ignore-file
// ----------------------------------------------------------------------------
// Operator
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// Factory
// ----------------------------------------------------------------------------
function Inferrable(name, type) {return _index2.Memory.Create({ '~kind': 'Inferrable' }, { name, type }, {});} // ----------------------------------------------------------------------------
// Guard
// ----------------------------------------------------------------------------
function IsInferable(value) {return _index3.Guard.IsObject(value) &&
  _index3.Guard.HasPropertyKey(value, '~kind') &&
  _index3.Guard.HasPropertyKey(value, 'name') &&
  _index3.Guard.HasPropertyKey(value, 'type') &&
  _index3.Guard.IsEqual(value["~kind"], 'Inferrable') &&
  _index3.Guard.IsString(value.name) &&
  _index3.Guard.IsObject(value.type);
}
function TryRestInferable(type) {
  return (0, _rest.IsRest)(type) ?
  (0, _infer.IsInfer)(type.items) ?
  (0, _array.IsArray)(type.items.extends) ? Inferrable(type.items.name, type.items.extends.items) :
  (0, _unknown.IsUnknown)(type.items.extends) ? Inferrable(type.items.name, type.items.extends) :
  undefined :
  (0, _index.Unreachable)() // undefined
  : undefined;
}
function TryInferable(type) {
  return (0, _infer.IsInfer)(type) ? Inferrable(type.name, type.extends) :
  undefined;
}
function TryInferResults(rest, right, result = []) {
  return _index3.Guard.TakeLeft(rest, (head, tail) => Result.Match((0, _extends_left.ExtendsLeft)({}, head, right), () => TryInferResults(tail, right, [...result, head]), () => undefined), () => result);
}
function InferTupleResult(inferred, name, left, right) {
  const results = TryInferResults(left, right);
  return _index3.Guard.IsArray(results) ?
  Result.ExtendsTrue(_index2.Memory.Assign(inferred, { [name]: (0, _tuple.Tuple)(results) })) :
  Result.ExtendsFalse();
}
function InferUnionResult(inferred, name, left, right) {
  const results = TryInferResults(left, right);
  return _index3.Guard.IsArray(results) ?
  Result.ExtendsTrue(_index2.Memory.Assign(inferred, { [name]: (0, _union.Union)(results) })) :
  Result.ExtendsFalse();
} /* v9-1a3f163e6fba34a0 */
