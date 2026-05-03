"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Cyclic = Cyclic;exports.CyclicOptions = CyclicOptions;exports.IsCyclic = IsCyclic;
var _index = require("../../guard/index.mjs");
var _index2 = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a Cyclic type. */
function Cyclic($defs, $ref, options) {
  // $defs require an $id per definition to enable Ajv to resolve correctly
  const defs = _index.Guard.Keys($defs).reduce((result, key) => {
    return { ...result, [key]: _index2.Memory.Update($defs[key], {}, { $id: key }) };
  }, {});
  return _index2.Memory.Create({ ['~kind']: 'Cyclic' }, { $defs: defs, $ref }, options);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is a TCyclic. */
function IsCyclic(value) {
  return (0, _schema.IsKind)(value, 'Cyclic');
}
// ------------------------------------------------------------------
// Options
// ------------------------------------------------------------------
/** Extracts options from a TCyclic. */
function CyclicOptions(type) {
  return _index2.Memory.Discard(type, ['~kind', '$defs', '$ref']);
} /* v9-60f01445d5eb652f */
