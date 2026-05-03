"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromObject = FromObject;
var _index = require("../../../system/unreachable/index.mjs");
var _index2 = require("../../../guard/index.mjs");
var _literal = require("../../types/literal.mjs");
var _keys = require("../helpers/keys.mjs");
var _evaluate = require("../evaluate/evaluate.mjs"); // deno-fmt-ignore-file
function FromPropertyKeys(keys) {
  const result = keys.reduce((result, left) => {
    return (0, _literal.IsLiteralValue)(left) ?
    [...result, (0, _literal.Literal)((0, _keys.ConvertToIntegerKey)(left))] :
    (0, _index.Unreachable)();
  }, []);
  return result;
}
function FromObject(properties) {
  const propertyKeys = _index2.Guard.Keys(properties);
  const variants = FromPropertyKeys(propertyKeys);
  const result = (0, _evaluate.EvaluateUnionFast)(variants);
  return result;
} /* v9-c13573354f2941eb */
