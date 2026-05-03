"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Assign = Assign;

var _metrics = require("./metrics.mjs"); // deno-lint-ignore-file ban-types no-explicit-any
// deno-fmt-ignore-file
/**
 * Performs an Object assign using the Left and Right object types. We track this operation as it
 * creates a new GC handle per assignment.
 */function Assign(left, right) {
  _metrics.Metrics.assign += 1;
  return { ...left, ...right };
} /* v9-a2a1404ce83492c1 */
