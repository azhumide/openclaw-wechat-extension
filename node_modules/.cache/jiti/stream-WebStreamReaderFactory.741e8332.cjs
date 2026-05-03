"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.makeWebStreamReader = makeWebStreamReader;var _WebStreamByobReader = require("./WebStreamByobReader.js");
var _WebStreamDefaultReader = require("./WebStreamDefaultReader.js");
function makeWebStreamReader(stream) {
  try {
    const reader = stream.getReader({ mode: "byob" });
    if (reader instanceof ReadableStreamDefaultReader) {
      // Fallback to default reader in case `mode: byob` is ignored
      return new _WebStreamDefaultReader.WebStreamDefaultReader(reader);
    }
    return new _WebStreamByobReader.WebStreamByobReader(reader);
  }
  catch (error) {
    if (error instanceof TypeError) {
      // Fallback to default reader in case `mode: byob` rejected by a `TypeError`
      return new _WebStreamDefaultReader.WebStreamDefaultReader(stream.getReader());
    }
    throw error;
  }
} /* v9-f822a8c977ea6923 */
