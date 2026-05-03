"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Intersect = Intersect;exports.IntersectOptions = IntersectOptions;exports.IsIntersect = IsIntersect;
var _index = require("../../system/memory/index.mjs");
var _schema = require("./schema.mjs"); // deno-fmt-ignore-file
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
/** Creates a Intersect type. */
function Intersect(types, options = {}) {
  return _index.Memory.Create({ '~kind': 'Intersect' }, { allOf: types }, options);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is TIntersect. */
function IsIntersect(value) {
  return (0, _schema.IsKind)(value, 'Intersect');
}
// ------------------------------------------------------------------
// Options
// ------------------------------------------------------------------
/** Extracts options from a TIntersect. */
function IntersectOptions(type) {
  return _index.Memory.Discard(type, ['~kind', 'allOf']);
} /* v9-2050a9835470f29c */
