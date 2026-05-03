"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Pick = Pick;exports.PickDeferred = PickDeferred;
var _index = require("../../guard/index.mjs");
var _deferred = require("../types/deferred.mjs");
var _keys_to_indexer = require("../engine/helpers/keys_to_indexer.mjs");
var _instantiate = require("../engine/pick/instantiate.mjs"); // deno-fmt-ignore-file
/** Creates a deferred Pick action. */
function PickDeferred(type, indexer, options = {}) {
  return (0, _deferred.Deferred)('Pick', [type, indexer], options);
}
/** Applies a Pick action using the given types. */
function Pick(type, indexer_or_keys, options = {}) {
  const indexer = _index.Guard.IsArray(indexer_or_keys) ? (0, _keys_to_indexer.KeysToIndexer)(indexer_or_keys) : indexer_or_keys;
  return (0, _instantiate.PickAction)(type, indexer, options);
} /* v9-a332b5780d2c997d */
