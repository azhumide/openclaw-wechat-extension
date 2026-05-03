"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Get = Get;exports.Reset = Reset;exports.Set = Set;
var _en_US = require("./en_US.mjs"); // deno-fmt-ignore-file
let locale = _en_US.en_US;
/** Sets the locale */
function Set(callback) {
  locale = callback;
}
/** Gets the locale */
function Get() {
  return locale;
}
/** Resets the locale to `en_US` */
function Reset() {
  Set(_en_US.en_US);
} /* v9-d4c38f2baa2a6803 */
