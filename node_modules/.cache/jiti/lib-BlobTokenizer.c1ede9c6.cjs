"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.BlobTokenizer = void 0;var _index = require("./stream/index.js");
var _AbstractTokenizer = require("./AbstractTokenizer.js");
class BlobTokenizer extends _AbstractTokenizer.AbstractTokenizer {
  /**
   * Construct BufferTokenizer
   * @param blob - Uint8Array to tokenize
   * @param options Tokenizer options
   */
  constructor(blob, options) {
    super(options);
    this.blob = blob;
    this.fileInfo = { ...(options?.fileInfo ?? {}), ...{ size: blob.size, mimeType: blob.type } };
  }
  /**
   * Read buffer from tokenizer
   * @param uint8Array - Uint8Array to tokenize
   * @param options - Read behaviour options
   * @returns {Promise<number>}
   */
  async readBuffer(uint8Array, options) {
    if (options?.position) {
      this.position = options.position;
    }
    const bytesRead = await this.peekBuffer(uint8Array, options);
    this.position += bytesRead;
    return bytesRead;
  }
  /**
   * Peek (read ahead) buffer from tokenizer
   * @param buffer
   * @param options - Read behaviour options
   * @returns {Promise<number>}
   */
  async peekBuffer(buffer, options) {
    const normOptions = this.normalizeOptions(buffer, options);
    const bytes2read = Math.min(this.blob.size - normOptions.position, normOptions.length);
    if (!normOptions.mayBeLess && bytes2read < normOptions.length) {
      throw new _index.EndOfStreamError();
    }
    const arrayBuffer = await this.blob.slice(normOptions.position, normOptions.position + bytes2read).arrayBuffer();
    buffer.set(new Uint8Array(arrayBuffer));
    return bytes2read;
  }
  close() {
    return super.close();
  }
  supportsRandomAccess() {
    return true;
  }
  setPosition(position) {
    this.position = position;
  }
}exports.BlobTokenizer = BlobTokenizer; /* v9-1afa50042acbbe22 */
