"use strict";Object.defineProperty(exports, "__esModule", { value: true });var _exportNames = { Type: true };exports.default = exports.Type = void 0;


var _index = require("./type/action/index.mjs");Object.keys(_index).forEach(function (key) {if (key === "default" || key === "__esModule") return;if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;if (key in exports && exports[key] === _index[key]) return;Object.defineProperty(exports, key, { enumerable: true, get: function () {return _index[key];} });});
var _index2 = require("./type/engine/index.mjs");Object.keys(_index2).forEach(function (key) {if (key === "default" || key === "__esModule") return;if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;if (key in exports && exports[key] === _index2[key]) return;Object.defineProperty(exports, key, { enumerable: true, get: function () {return _index2[key];} });});
var _index3 = require("./type/extends/index.mjs");Object.keys(_index3).forEach(function (key) {if (key === "default" || key === "__esModule") return;if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;if (key in exports && exports[key] === _index3[key]) return;Object.defineProperty(exports, key, { enumerable: true, get: function () {return _index3[key];} });});
var _index4 = require("./type/script/index.mjs");Object.keys(_index4).forEach(function (key) {if (key === "default" || key === "__esModule") return;if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;if (key in exports && exports[key] === _index4[key]) return;Object.defineProperty(exports, key, { enumerable: true, get: function () {return _index4[key];} });});
var _index5 = require("./type/types/index.mjs");Object.keys(_index5).forEach(function (key) {if (key === "default" || key === "__esModule") return;if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;if (key in exports && exports[key] === _index5[key]) return;Object.defineProperty(exports, key, { enumerable: true, get: function () {return _index5[key];} });});




var _Type = _interopRequireWildcard(require("./typebox.mjs"));var Type = _Type;exports.Type = _Type;function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);} // ------------------------------------------------------------------
// Standard
// ------------------------------------------------------------------
// ------------------------------------------------------------------
// TypeBox
// ------------------------------------------------------------------
var _default = exports.default = Type; /* v9-1c7b6232a67b31b0 */
