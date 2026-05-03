"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ExtendsUnion = ExtendsUnion;
var _index = require("../../guard/index.mjs");
var _union = require("../types/union.mjs");
var _extends_left = require("./extends_left.mjs");
var Result = _interopRequireWildcard(require("./result.mjs"));



var _inference = require("./inference.mjs");function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);} // deno-fmt-ignore-file
// ----------------------------------------------------------------------------
// Inference
// ----------------------------------------------------------------------------
function ExtendsUnionSome(inferred, type, unionTypes) {return _index.Guard.TakeLeft(unionTypes, (head, tail) => Result.Match((0, _extends_left.ExtendsLeft)(inferred, type, head), (inferred) => Result.ExtendsTrue(inferred), () => ExtendsUnionSome(inferred, type, tail)), () => Result.ExtendsFalse());}function ExtendsUnionLeft(inferred, left, right) {
  return _index.Guard.TakeLeft(left, (head, tail) => Result.Match(ExtendsUnionSome(inferred, head, right), (inferred) => ExtendsUnionLeft(inferred, tail, right), () => Result.ExtendsFalse()), () => Result.ExtendsTrue(inferred));
}
function ExtendsUnion(inferred, left, right) {
  const inferrable = (0, _inference.TryInferable)(right);
  return (0, _inference.IsInferable)(inferrable)
  // @ts-ignore 4.9.5 fails to see `type` property on inferrable
  ? (0, _inference.InferUnionResult)(inferred, inferrable.name, left, inferrable.type) :
  (0, _union.IsUnion)(right) ?
  ExtendsUnionLeft(inferred, left, right.anyOf) :
  ExtendsUnionLeft(inferred, left, [right]);
} /* v9-51be1744f417b648 */
