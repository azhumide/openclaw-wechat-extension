"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Index = Index;exports.IndexDeferred = IndexDeferred;
var _index = require("../../guard/index.mjs");
var _deferred = require("../types/deferred.mjs");
var _keys_to_indexer = require("../engine/helpers/keys_to_indexer.mjs");
var _instantiate = require("../engine/indexed/instantiate.mjs"); // deno-fmt-ignore-file
/** Creates a deferred Index action. */
function IndexDeferred(type, indexer, options = {}) {
  return (0, _deferred.Deferred)('Index', [type, indexer], options);
}
/** Applies a Index action using the given types. */
function Index(type, indexer_or_keys, options = {}) {
  const indexer = _index.Guard.IsArray(indexer_or_keys) ? (0, _keys_to_indexer.KeysToIndexer)(indexer_or_keys) : indexer_or_keys;
  return (0, _instantiate.IndexAction)(type, indexer, options);
} /* v9-b9cfa947a39ee34b */
