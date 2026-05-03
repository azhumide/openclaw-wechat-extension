"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.TupleElementsToProperties = TupleElementsToProperties;exports.TupleToObject = TupleToObject;

var _object = require("../../types/object.mjs"); // deno-lint-ignore-file ban-types
// deno-fmt-ignore-file
function TupleElementsToProperties(types) {const result = types.reduceRight((result, right, index) => {
    return { [index]: right, ...result };
  }, {});
  return result;
}
function TupleToObject(type) {
  const properties = TupleElementsToProperties(type.items);
  const result = (0, _object.Object)(properties);
  return result;
} /* v9-4a616acbd59ddcae */
