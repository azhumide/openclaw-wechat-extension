"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromNumberKey = FromNumberKey;
var _record = require("../../types/record.mjs");
var _record_create = require("./record_create.mjs"); // deno-fmt-ignore-file
function FromNumberKey(_key, value) {
  const result = (0, _record_create.CreateRecord)(_record.NumberKey, value);
  return result;
} /* v9-f105e9b417fd88a4 */
