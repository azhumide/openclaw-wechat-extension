"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FromIntegerKey = FromIntegerKey;
var _record = require("../../types/record.mjs");
var _record_create = require("./record_create.mjs"); // deno-fmt-ignore-file
function FromIntegerKey(_key, value) {
  const result = (0, _record_create.CreateRecord)(_record.IntegerKey, value);
  return result;
} /* v9-44f11959daa12d0d */
