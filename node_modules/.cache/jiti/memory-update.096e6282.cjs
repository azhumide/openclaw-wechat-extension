"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Update = Update;
var _index = require("../settings/index.mjs");
var _metrics = require("./metrics.mjs");
var _clone = require("./clone.mjs"); // deno-fmt-ignore-file
/**
 * Updates a value with new properties while preserving property enumerability. Use this function to modify
 * existing types without altering their configuration.
 */
function Update(current, hidden, enumerable) {
  _metrics.Metrics.update += 1;
  const settings = _index.Settings.Get();
  const result = (0, _clone.Clone)(current);
  // hidden
  for (const key of Object.keys(hidden)) {
    Object.defineProperty(result, key, {
      configurable: true,
      writable: true,
      enumerable: settings.enumerableKind,
      value: hidden[key]
    });
  }
  // enumerable
  for (const key of Object.keys(enumerable)) {
    Object.defineProperty(result, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: enumerable[key]
    });
  }
  return result;
} /* v9-db0454a40da88c74 */
