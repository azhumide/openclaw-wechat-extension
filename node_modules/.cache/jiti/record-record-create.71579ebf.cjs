"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.CreateRecord = CreateRecord;
var _index = require("../../../system/memory/index.mjs"); // deno-fmt-ignore-file
function CreateRecord(key, value) {
  const type = 'object';
  const patternProperties = { [key]: value };
  return _index.Memory.Create({ ['~kind']: 'Record' }, { type, patternProperties });
} /* v9-d89f98d4d17db39a */
