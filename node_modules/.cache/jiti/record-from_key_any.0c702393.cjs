"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromAnyKey = FromAnyKey;
var _record = require("../../types/record.mjs");
var _record_create = require("./record_create.mjs"); // deno-fmt-ignore-file
function FromAnyKey(value) {
  return (0, _record_create.CreateRecord)(_record.StringKey, value);
} /* v9-ceaacbd45e75f984 */
