"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.n = registerActiveProgressLine;exports.r = unregisterActiveProgressLine;exports.t = clearActiveProgressLine; //#region src/terminal/progress-line.ts
let activeStream = null;
function registerActiveProgressLine(stream) {
  if (!stream.isTTY) return;
  activeStream = stream;
}
function clearActiveProgressLine() {
  if (!activeStream?.isTTY) return;
  activeStream.write("\r\x1B[2K");
}
function unregisterActiveProgressLine(stream) {
  if (!activeStream) return;
  if (stream && activeStream !== stream) return;
  activeStream = null;
}
//#endregion /* v9-2a6f36cf2e62f5a0 */
