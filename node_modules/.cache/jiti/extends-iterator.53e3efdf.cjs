"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ExtendsIterator = ExtendsIterator;
var _iterator = require("../types/iterator.mjs");
var _extends_right = require("./extends_right.mjs");
var _extends_left = require("./extends_left.mjs"); // deno-fmt-ignore-file
function ExtendsIterator(inferred, left, right) {
  return (0, _iterator.IsIterator)(right) ?
  (0, _extends_left.ExtendsLeft)(inferred, left, right.iteratorItems) :
  (0, _extends_right.ExtendsRight)(inferred, (0, _iterator.Iterator)(left), right);
} /* v9-52b80b6d4d8168b2 */
