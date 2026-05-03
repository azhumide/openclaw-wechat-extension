"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.WebStreamDefaultReader = void 0;var _Errors = require("./Errors.js");
var _AbstractStreamReader = require("./AbstractStreamReader.js");
class WebStreamDefaultReader extends _AbstractStreamReader.AbstractStreamReader {
  constructor(reader) {
    super();
    this.reader = reader;
    this.buffer = null; // Internal buffer to store excess data
  }
  /**
   * Copy chunk to target, and store the remainder in this.buffer
   */
  writeChunk(target, chunk) {
    const written = Math.min(chunk.length, target.length);
    target.set(chunk.subarray(0, written));
    // Adjust the remainder of the buffer
    if (written < chunk.length) {
      this.buffer = chunk.subarray(written);
    } else
    {
      this.buffer = null;
    }
    return written;
  }
  /**
   * Read from stream
   * @param buffer - Target Uint8Array (or Buffer) to store data read from stream in
   * @param mayBeLess - If true, may fill the buffer partially
   * @protected Bytes read
   */
  async readFromStream(buffer, mayBeLess) {
    if (buffer.length === 0)
    return 0;
    let totalBytesRead = 0;
    // Serve from the internal buffer first
    if (this.buffer) {
      totalBytesRead += this.writeChunk(buffer, this.buffer);
    }
    // Continue reading from the stream if more data is needed
    while (totalBytesRead < buffer.length && !this.endOfStream) {
      const result = await this.reader.read();
      if (result.done) {
        this.endOfStream = true;
        break;
      }
      if (result.value) {
        totalBytesRead += this.writeChunk(buffer.subarray(totalBytesRead), result.value);
      }
    }
    if (!mayBeLess && totalBytesRead === 0 && this.endOfStream) {
      throw new _Errors.EndOfStreamError();
    }
    return totalBytesRead;
  }
  abort() {
    this.interrupted = true;
    return this.reader.cancel();
  }
  async close() {
    await this.abort();
    this.reader.releaseLock();
  }
}exports.WebStreamDefaultReader = WebStreamDefaultReader; /* v9-3fdeb596bf3bdaf6 */
