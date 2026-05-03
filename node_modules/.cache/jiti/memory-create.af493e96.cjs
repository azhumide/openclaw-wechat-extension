"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Create = Create;

var _index = require("../settings/index.mjs");
var _metrics = require("./metrics.mjs"); // deno-lint-ignore-file no-explicit-any
// deno-fmt-ignore-file
function MergeHidden(left, right) {for (const key of Object.keys(right)) {
    Object.defineProperty(left, key, {
      configurable: true,
      writable: true,
      enumerable: false,
      value: right[key]
    });
  }
  return left;
}
function Merge(left, right) {
  return { ...left, ...right };
}
/**
 * Creates an object with hidden, enumerable, and optional property sets. This function
 * ensures types are instantiated according to configuration rules for enumerable and
 * non-enumerable properties.
 */
function Create(hidden, enumerable, options = {}) {
  _metrics.Metrics.create += 1;
  const settings = _index.Settings.Get();
  const withOptions = Merge(enumerable, options);
  const withHidden = settings.enumerableKind ? Merge(withOptions, hidden) : MergeHidden(withOptions, hidden);
  return settings.immutableTypes ? Object.freeze(withHidden) : withHidden;
} /* v9-d670f5b62776f534 */
