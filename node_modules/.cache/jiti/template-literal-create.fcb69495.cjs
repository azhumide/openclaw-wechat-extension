"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.TemplateLiteralCreate = TemplateLiteralCreate;
var _index = require("../../../system/memory/index.mjs"); // deno-fmt-ignore-file
function TemplateLiteralCreate(pattern) {
  return _index.Memory.Create({ ['~kind']: 'TemplateLiteral' }, { type: 'string', pattern }, {});
} /* v9-557c768daa853c9e */
