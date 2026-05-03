"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.RestSpread = RestSpread;
var _infer = require("../../types/infer.mjs");
var _never = require("../../types/never.mjs");
var _rest = require("../../types/rest.mjs");
var _ref = require("../../types/ref.mjs");
var _tuple = require("../../types/tuple.mjs"); // deno-fmt-ignore-file
function SpreadElement(type) {
  const result = (0, _rest.IsRest)(type) ? (0, _tuple.IsTuple)(type.items) ? RestSpread(type.items.items) :
  (0, _infer.IsInfer)(type.items) ? [type] :
  (0, _ref.IsRef)(type.items) ? [type] :
  [(0, _never.Never)()] : [type];
  return result;
}
function RestSpread(types) {
  const result = types.reduce((result, left) => {
    return [...result, ...SpreadElement(left)];
  }, []);
  return result;
} /* v9-9d8902a10a690910 */
