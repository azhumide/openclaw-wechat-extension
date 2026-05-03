"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Get = Get;exports.Reset = Reset;exports.Set = Set;var _index = require("../../guard/index.mjs");
// Internal mutable state
const settings = {
  immutableTypes: false,
  maxErrors: 8,
  useAcceleration: true,
  exactOptionalPropertyTypes: false,
  enumerableKind: false,
  correctiveParse: false
};
/** Resets system settings to defaults */
function Reset() {
  settings.immutableTypes = false;
  settings.maxErrors = 8;
  settings.useAcceleration = true;
  settings.exactOptionalPropertyTypes = false;
  settings.enumerableKind = false;
  settings.correctiveParse = false;
}
/** Sets system settings */
function Set(options) {
  for (const key of _index.Guard.Keys(options)) {
    const value = options[key];
    if (value !== undefined) {
      Object.defineProperty(settings, key, { value });
    }
  }
}
/** Gets current system settings */
function Get() {
  return settings;
} /* v9-7cd26e8f5a59497d */
