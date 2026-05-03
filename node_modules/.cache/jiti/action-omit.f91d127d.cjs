"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Omit = Omit;exports.OmitDeferred = OmitDeferred;
var _index = require("../../guard/index.mjs");
var _deferred = require("../types/deferred.mjs");
var _keys_to_indexer = require("../engine/helpers/keys_to_indexer.mjs");
var _instantiate = require("../engine/omit/instantiate.mjs"); // deno-fmt-ignore-file
/** Creates a deferred Omit action. */
function OmitDeferred(type, indexer, options = {}) {
  return (0, _deferred.Deferred)('Omit', [type, indexer], options);
}
/** Applies a Omit action using the given types. */
function Omit(type, indexer_or_keys, options = {}) {
  const indexer = _index.Guard.IsArray(indexer_or_keys) ? (0, _keys_to_indexer.KeysToIndexer)(indexer_or_keys) : indexer_or_keys;
  return (0, _instantiate.OmitAction)(type, indexer, options);
} /* v9-7cb7ef29c374bc28 */
