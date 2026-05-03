"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.WebStreamReader = void 0;var _AbstractStreamReader = require("./AbstractStreamReader.js");
class WebStreamReader extends _AbstractStreamReader.AbstractStreamReader {
  constructor(reader) {
    super();
    this.reader = reader;
  }
  async abort() {
    return this.close();
  }
  async close() {
    this.reader.releaseLock();
  }
}exports.WebStreamReader = WebStreamReader; /* v9-bc271a1d0ec9bc2d */
