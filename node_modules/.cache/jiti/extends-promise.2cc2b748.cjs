"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ExtendsPromise = ExtendsPromise;
var _promise = require("../types/promise.mjs");
var _extends_right = require("./extends_right.mjs");
var _extends_left = require("./extends_left.mjs"); // deno-fmt-ignore-file
function ExtendsPromise(inferred, left, right) {
  return (0, _promise.IsPromise)(right) ?
  (0, _extends_left.ExtendsLeft)(inferred, left, right.item) :
  (0, _extends_right.ExtendsRight)(inferred, (0, _promise.Promise)(left), right);
} /* v9-a9da275ce7543977 */
