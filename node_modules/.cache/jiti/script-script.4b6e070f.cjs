"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Script = Script;

var _index = require("../../system/arguments/index.mjs");
var _index2 = require("../../system/memory/index.mjs");
var _index3 = require("../../guard/index.mjs");
var _instantiate = require("../engine/instantiate.mjs");
var _index4 = require("../types/index.mjs");
var Parser = _interopRequireWildcard(require("./parser.mjs"));function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);} // deno-lint-ignore-file
// deno-fmt-ignore-file
/** Parses a type from a TypeScript type expression */function Script(...args) {
  const [context, input, options] = _index.Arguments.Match(args, {
    2: (script, options) => _index3.Guard.IsString(script) ? [{}, script, options] : [script, options, {}],
    3: (context, script, options) => [context, script, options],
    1: (script) => [{}, script, {}]
  });
  const result = Parser.Script(input);
  const parsed = _index3.Guard.IsArray(result) && _index3.Guard.IsEqual(result.length, 2) ?
  (0, _instantiate.InstantiateType)(context, { callstack: [] }, result[0]) :
  (0, _index4.Never)();
  return _index2.Memory.Update(parsed, {}, options);
} /* v9-ffb91f4d1090684b */
