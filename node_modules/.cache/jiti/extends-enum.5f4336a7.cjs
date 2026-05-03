"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ExtendsEnum = ExtendsEnum;
var _extends_left = require("./extends_left.mjs");
var _index = require("../engine/enum/index.mjs"); // deno-fmt-ignore-file
function ExtendsEnum(inferred, left, right) {
  return (0, _extends_left.ExtendsLeft)(inferred, (0, _index.EnumToUnion)(left), right);
} /* v9-7e9bbd4ebee9a195 */
