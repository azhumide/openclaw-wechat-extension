"use strict";Object.defineProperty(exports, "__esModule", { value: true });Object.defineProperty(exports, "AbortError", { enumerable: true, get: function () {return _index.AbortError;} });Object.defineProperty(exports, "AbstractTokenizer", { enumerable: true, get: function () {return _AbstractTokenizer.AbstractTokenizer;} });Object.defineProperty(exports, "EndOfStreamError", { enumerable: true, get: function () {return _index.EndOfStreamError;} });exports.fromBlob = fromBlob;exports.fromBuffer = fromBuffer;exports.fromStream = fromStream;exports.fromWebStream = fromWebStream;var _index = require("./stream/index.js");
var _ReadStreamTokenizer = require("./ReadStreamTokenizer.js");
var _BufferTokenizer = require("./BufferTokenizer.js");
var _BlobTokenizer = require("./BlobTokenizer.js");

var _AbstractTokenizer = require("./AbstractTokenizer.js");
/**
 * Construct ReadStreamTokenizer from given Stream.
 * Will set fileSize, if provided given Stream has set the .path property/
 * @param stream - Read from Node.js Stream.Readable
 * @param options - Tokenizer options
 * @returns ReadStreamTokenizer
 */
function fromStream(stream, options) {
  const streamReader = new _index.StreamReader(stream);
  const _options = options ?? {};
  const chainedClose = _options.onClose;
  _options.onClose = async () => {
    await streamReader.close();
    if (chainedClose) {
      return chainedClose();
    }
  };
  return new _ReadStreamTokenizer.ReadStreamTokenizer(streamReader, _options);
}
/**
 * Construct ReadStreamTokenizer from given ReadableStream (WebStream API).
 * Will set fileSize, if provided given Stream has set the .path property/
 * @param webStream - Read from Node.js Stream.Readable (must be a byte stream)
 * @param options - Tokenizer options
 * @returns ReadStreamTokenizer
 */
function fromWebStream(webStream, options) {
  const webStreamReader = (0, _index.makeWebStreamReader)(webStream);
  const _options = options ?? {};
  const chainedClose = _options.onClose;
  _options.onClose = async () => {
    await webStreamReader.close();
    if (chainedClose) {
      return chainedClose();
    }
  };
  return new _ReadStreamTokenizer.ReadStreamTokenizer(webStreamReader, _options);
}
/**
 * Construct ReadStreamTokenizer from given Buffer.
 * @param uint8Array - Uint8Array to tokenize
 * @param options - Tokenizer options
 * @returns BufferTokenizer
 */
function fromBuffer(uint8Array, options) {
  return new _BufferTokenizer.BufferTokenizer(uint8Array, options);
}
/**
 * Construct ReadStreamTokenizer from given Blob.
 * @param blob - Uint8Array to tokenize
 * @param options - Tokenizer options
 * @returns BufferTokenizer
 */
function fromBlob(blob, options) {
  return new _BlobTokenizer.BlobTokenizer(blob, options);
} /* v9-938982f7b0375ceb */
