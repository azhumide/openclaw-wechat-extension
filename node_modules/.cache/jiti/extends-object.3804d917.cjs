"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ExtendsObject = ExtendsObject;

var _index = require("../../system/unreachable/index.mjs");
var _index2 = require("../../system/memory/index.mjs");
var _index3 = require("../../guard/index.mjs");
var _optional = require("../types/_optional.mjs");
var _infer = require("../types/infer.mjs");
var _never = require("../types/never.mjs");
var _object = require("../types/object.mjs");
var _extends_left = require("./extends_left.mjs");
var _extends_right = require("./extends_right.mjs");
var Result = _interopRequireWildcard(require("./result.mjs"));function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);} // deno-lint-ignore-file ban-types
// deno-fmt-ignore-file
function ExtendsPropertyOptional(inferred, left, right) {return (0, _optional.IsOptional)(left) ?
  (0, _optional.IsOptional)(right) ?
  Result.ExtendsTrue(inferred) :
  Result.ExtendsFalse() :
  Result.ExtendsTrue(inferred);
}
function ExtendsProperty(inferred, left, right) {
  return (
    // Right TInfer<TNever> is TExtendsFalse
    (0, _infer.IsInfer)(right) && (0, _never.IsNever)(right.extends) ?
    Result.ExtendsFalse() :
    Result.Match((0, _extends_left.ExtendsLeft)(inferred, left, right), (inferred) => ExtendsPropertyOptional(inferred, left, right), () => Result.ExtendsFalse()));
}
function ExtractInferredProperties(keys, properties) {
  return keys.reduce((result, key) => {
    return key in properties ?
    Result.IsExtendsTrueLike(properties[key])
    // @ts-ignore 5.0.4 cannot see `.inferred`
    ? { ...result, ...properties[key].inferred } :
    (0, _index.Unreachable)() // result
    : (0, _index.Unreachable)(); // result
  }, {});
}
function ExtendsPropertiesComparer(inferred, left, right) {
  const properties = {};
  for (const rightKey of _index3.Guard.Keys(right)) {
    properties[rightKey] = rightKey in left
    // We don't consider the exterior Inferred as part of the property check as
    // we don't want the exterior Context to override the Inferred Context for
    // the Property Key. This override behavior is observed in the following
    // case we want the inferred A to shadow the exterior A.
    //
    // const A = Type.Script(`{ x: 1, y: 1 }`)
    // const S = Type.Script({ A }, `{
    //   [K in keyof A]: A extends { 
    //     x: infer A, 
    //     y: infer B 
    //   } ? [A, B]   <-- inferred 'A' shadows the exterior 'A'
    //     : never
    // }`)
    ? ExtendsProperty({}, left[rightKey], right[rightKey])
    // If the right key K is not in left, but the right property is optional
    // then we say this property is permissable. This is because an optional
    // property on right is the same as property missing in left. If the
    // right is infer, then we just assign the extend type to inferred.
    : (0, _optional.IsOptional)(right[rightKey]) ?
    (0, _infer.IsInfer)(right[rightKey])
    // @ts-ignore 5.0.1 - cannot observe extend in right[rightKey].extends
    ? Result.ExtendsTrue(_index2.Memory.Assign(inferred, { [right[rightKey].name]: right[rightKey].extends })) :
    Result.ExtendsTrue(inferred) :
    Result.ExtendsFalse();
  }
  // Check if all properties are ExtendsTrueLike
  const checked = _index3.Guard.Values(properties).every((result) => Result.IsExtendsTrueLike(result));
  // Extract inferred results from properties, but only if the check is true.
  const extracted = checked ? ExtractInferredProperties(_index3.Guard.Keys(properties), properties) : {};
  return checked ?
  Result.ExtendsTrue(extracted) :
  Result.ExtendsFalse();
}
function ExtendsProperties(inferred, left, right) {
  const compared = ExtendsPropertiesComparer(inferred, left, right);
  return Result.IsExtendsTrueLike(compared) ?
  Result.ExtendsTrue(_index2.Memory.Assign(inferred, compared.inferred)) :
  Result.ExtendsFalse();
}
function ExtendsObjectToObject(inferred, left, right) {
  return ExtendsProperties(inferred, left, right);
}
function ExtendsObject(inferred, left, right) {
  return (0, _object.IsObject)(right) ?
  ExtendsObjectToObject(inferred, left, right.properties) :
  (0, _extends_right.ExtendsRight)(inferred, (0, _object.Object)(left), right);
} /* v9-3e6cfcc694ac56f3 */
