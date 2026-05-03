"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ExtendsLeft = ExtendsLeft;
var _any = require("./any.mjs");
var _array = require("./array.mjs");
var _async_iterator = require("./async_iterator.mjs");
var _bigint = require("./bigint.mjs");
var _boolean = require("./boolean.mjs");
var _constructor = require("./constructor.mjs");
var _enum = require("./enum.mjs");
var _function = require("./function.mjs");
var _integer = require("./integer.mjs");
var _intersect = require("./intersect.mjs");
var _iterator = require("./iterator.mjs");
var _literal = require("./literal.mjs");
var _never = require("./never.mjs");
var _null = require("./null.mjs");
var _number = require("./number.mjs");
var _object = require("./object.mjs");
var _promise = require("./promise.mjs");
var _string = require("./string.mjs");
var _symbol = require("./symbol.mjs");
var _template_literal = require("./template_literal.mjs");
var _tuple = require("./tuple.mjs");
var _undefined = require("./undefined.mjs");
var _union = require("./union.mjs");
var _unknown = require("./unknown.mjs");
var _void = require("./void.mjs");



var _any2 = require("../types/any.mjs");
var _array2 = require("../types/array.mjs");
var _async_iterator2 = require("../types/async_iterator.mjs");
var _bigint2 = require("../types/bigint.mjs");
var _boolean2 = require("../types/boolean.mjs");
var _constructor2 = require("../types/constructor.mjs");
var _enum2 = require("../types/enum.mjs");
var _function2 = require("../types/function.mjs");
var _integer2 = require("../types/integer.mjs");
var _intersect2 = require("../types/intersect.mjs");
var _iterator2 = require("../types/iterator.mjs");
var _literal2 = require("../types/literal.mjs");
var _never2 = require("../types/never.mjs");
var _null2 = require("../types/null.mjs");
var _number2 = require("../types/number.mjs");
var _object2 = require("../types/object.mjs");
var _promise2 = require("../types/promise.mjs");
var _string2 = require("../types/string.mjs");
var _symbol2 = require("../types/symbol.mjs");
var _template_literal2 = require("../types/template_literal.mjs");
var _tuple2 = require("../types/tuple.mjs");
var _undefined2 = require("../types/undefined.mjs");
var _unknown2 = require("../types/unknown.mjs");
var _union2 = require("../types/union.mjs");
var _void2 = require("../types/void.mjs");
var Result = _interopRequireWildcard(require("./result.mjs"));function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);} // deno-fmt-ignore-file
// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
function ExtendsLeft(inferred, left, right) {return (0, _any2.IsAny)(left) ? (0, _any.ExtendsAny)(inferred, left, right) : (0, _array2.IsArray)(left) ? (0, _array.ExtendsArray)(inferred, left, left.items, right) : (0, _async_iterator2.IsAsyncIterator)(left) ? (0, _async_iterator.ExtendsAsyncIterator)(inferred, left.iteratorItems, right) :
  (0, _bigint2.IsBigInt)(left) ? (0, _bigint.ExtendsBigInt)(inferred, left, right) :
  (0, _boolean2.IsBoolean)(left) ? (0, _boolean.ExtendsBoolean)(inferred, left, right) :
  (0, _constructor2.IsConstructor)(left) ? (0, _constructor.ExtendsConstructor)(inferred, left.parameters, left.instanceType, right) :
  (0, _enum2.IsEnum)(left) ? (0, _enum.ExtendsEnum)(inferred, left, right) :
  (0, _function2.IsFunction)(left) ? (0, _function.ExtendsFunction)(inferred, left.parameters, left.returnType, right) :
  (0, _integer2.IsInteger)(left) ? (0, _integer.ExtendsInteger)(inferred, left, right) :
  (0, _intersect2.IsIntersect)(left) ? (0, _intersect.ExtendsIntersect)(inferred, left.allOf, right) :
  (0, _iterator2.IsIterator)(left) ? (0, _iterator.ExtendsIterator)(inferred, left.iteratorItems, right) :
  (0, _literal2.IsLiteral)(left) ? (0, _literal.ExtendsLiteral)(inferred, left, right) :
  (0, _never2.IsNever)(left) ? (0, _never.ExtendsNever)(inferred, left, right) :
  (0, _null2.IsNull)(left) ? (0, _null.ExtendsNull)(inferred, left, right) :
  (0, _number2.IsNumber)(left) ? (0, _number.ExtendsNumber)(inferred, left, right) :
  (0, _object2.IsObject)(left) ? (0, _object.ExtendsObject)(inferred, left.properties, right) :
  (0, _promise2.IsPromise)(left) ? (0, _promise.ExtendsPromise)(inferred, left.item, right) :
  (0, _string2.IsString)(left) ? (0, _string.ExtendsString)(inferred, left, right) :
  (0, _symbol2.IsSymbol)(left) ? (0, _symbol.ExtendsSymbol)(inferred, left, right) :
  (0, _template_literal2.IsTemplateLiteral)(left) ? (0, _template_literal.ExtendsTemplateLiteral)(inferred, left.pattern, right) :
  (0, _tuple2.IsTuple)(left) ? (0, _tuple.ExtendsTuple)(inferred, left.items, right) :
  (0, _undefined2.IsUndefined)(left) ? (0, _undefined.ExtendsUndefined)(inferred, left, right) :
  (0, _union2.IsUnion)(left) ? (0, _union.ExtendsUnion)(inferred, left.anyOf, right) :
  (0, _unknown2.IsUnknown)(left) ? (0, _unknown.ExtendsUnknown)(inferred, left, right) :
  (0, _void2.IsVoid)(left) ? (0, _void.ExtendsVoid)(inferred, left, right) :
  Result.ExtendsFalse();
} /* v9-d9da26443b3d822f */
