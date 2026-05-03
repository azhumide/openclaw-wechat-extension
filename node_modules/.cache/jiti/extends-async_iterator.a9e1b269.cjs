"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ExtendsAsyncIterator = ExtendsAsyncIterator;
var _async_iterator = require("../types/async_iterator.mjs");
var _extends_right = require("./extends_right.mjs");
var _extends_left = require("./extends_left.mjs"); // deno-fmt-ignore-file
function ExtendsAsyncIterator(inferred, left, right) {
  return (0, _async_iterator.IsAsyncIterator)(right) ?
  (0, _extends_left.ExtendsLeft)(inferred, left, right.iteratorItems) :
  (0, _extends_right.ExtendsRight)(inferred, (0, _async_iterator.AsyncIterator)(left), right);
} /* v9-ecd575ae47217767 */
