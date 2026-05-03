"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ExtendsTuple = ExtendsTuple;
var _index = require("../../guard/index.mjs");
var _schema = require("../types/schema.mjs");
var _array = require("../types/array.mjs");
var _tuple = require("../types/tuple.mjs");
var _extends_left = require("./extends_left.mjs");
var _extends_right = require("./extends_right.mjs");
var Result = _interopRequireWildcard(require("./result.mjs"));
var _instantiate = require("../engine/instantiate.mjs");



var _inference = require("./inference.mjs");function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);} // deno-fmt-ignore-file
// ----------------------------------------------------------------------------
// Inference
// ----------------------------------------------------------------------------
function Reverse(types) {return [...types].reverse();}function ApplyReverse(types, reversed) {
  return reversed ? Reverse(types) : types;
}
function Reversed(types) {
  const first = types.length > 0 ? types[0] : undefined;
  const inferrable = (0, _schema.IsSchema)(first) ? (0, _inference.TryRestInferable)(first) : undefined;
  return (0, _schema.IsSchema)(inferrable);
}
function ElementsCompare(inferred, reversed, left, leftRest, right, rightRest) {
  return Result.Match((0, _extends_left.ExtendsLeft)(inferred, left, right), (checkInferred) => Elements(checkInferred, reversed, leftRest, rightRest), () => Result.ExtendsFalse()); // 'left-and-right-not-compared'
}
function ElementsLeft(inferred, reversed, leftRest, right, rightRest) {
  const inferable = (0, _inference.TryRestInferable)(right);
  return (
    // Rest Inferrable Right Means we delegate to TInferTupleResult to Generate a Result
    (0, _inference.IsInferable)(inferable) ?
    (0, _inference.InferTupleResult)(inferred, inferable['name'], ApplyReverse(leftRest, reversed), inferable['type']) :
    _index.Guard.TakeLeft(leftRest, (head, tail) => ElementsCompare(inferred, reversed, head, tail, right, rightRest), () => Result.ExtendsFalse()));
}
function ElementsRight(inferred, reversed, leftRest, rightRest) {
  return _index.Guard.TakeLeft(rightRest, (head, tail) => ElementsLeft(inferred, reversed, leftRest, head, tail), () => _index.Guard.IsEqual(leftRest.length, 0) ?
  Result.ExtendsTrue(inferred) // 'Ok: right-empty-and-left-empty'
  : Result.ExtendsFalse()); // 'Fail: right-empty-and-left-not-empty'
}
function Elements(inferred, reversed, leftRest, rightRest) {
  return ElementsRight(inferred, reversed, leftRest, rightRest);
}
function ExtendsTupleToTuple(inferred, left, right) {
  const instantiatedRight = (0, _instantiate.InstantiateElements)(inferred, { callstack: [] }, right);
  const reversed = Reversed(instantiatedRight);
  return Elements(inferred, reversed, ApplyReverse(left, reversed), ApplyReverse(instantiatedRight, reversed));
}
function ExtendsTupleToArray(inferred, left, right) {
  const inferrable = (0, _inference.TryInferable)(right);
  return (0, _inference.IsInferable)(inferrable) ?
  (0, _inference.InferUnionResult)(inferred, inferrable['name'], left, inferrable['type']) :
  _index.Guard.TakeLeft(left, (head, tail) => Result.Match((0, _extends_left.ExtendsLeft)(inferred, head, right), (inferred) => ExtendsTupleToArray(inferred, tail, right), () => Result.ExtendsFalse()), () => Result.ExtendsTrue(inferred));
}
function ExtendsTuple(inferred, left, right) {
  const instantiatedLeft = (0, _instantiate.InstantiateElements)(inferred, { callstack: [] }, left);
  return (0, _tuple.IsTuple)(right) ? ExtendsTupleToTuple(inferred, instantiatedLeft, right.items) :
  (0, _array.IsArray)(right) ? ExtendsTupleToArray(inferred, instantiatedLeft, right.items) :
  (0, _extends_right.ExtendsRight)(inferred, (0, _tuple.Tuple)(instantiatedLeft), right);
} /* v9-c731a7967495c31c */
