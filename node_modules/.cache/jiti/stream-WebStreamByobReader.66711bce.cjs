"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.WebStreamByobReader = void 0;var _WebStreamReader = require("./WebStreamReader.js");
/**
 * Read from a WebStream using a BYOB reader
 * Reference: https://nodejs.org/api/webstreams.html#class-readablestreambyobreader
 */
class WebStreamByobReader extends _WebStreamReader.WebStreamReader {
  /**
   * Read from stream
   * @param buffer - Target Uint8Array (or Buffer) to store data read from stream in
   * @param mayBeLess - If true, may fill the buffer partially
   * @protected Bytes read
   */
  async readFromStream(buffer, mayBeLess) {
    if (buffer.length === 0)
    return 0;
    // @ts-expect-error
    const result = await this.reader.read(new Uint8Array(buffer.length), { min: mayBeLess ? undefined : buffer.length });
    if (result.done) {
      this.endOfStream = result.done;
    }
    if (result.value) {
      buffer.set(result.value);
      return result.value.length;
    }
    return 0;
  }
}exports.WebStreamByobReader = WebStreamByobReader; /* v9-80587f4ed3877d95 */
