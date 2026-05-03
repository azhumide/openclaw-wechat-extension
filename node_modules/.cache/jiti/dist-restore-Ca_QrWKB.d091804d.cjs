"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.t = restoreTerminalState;var _progressLineXDw3PVgH = require("./progress-line-xDw3PVgH.js");
//#region src/terminal/restore.ts
const RESET_SEQUENCE = "\x1B[0m\x1B[?25h\x1B[?1000l\x1B[?1002l\x1B[?1003l\x1B[?1006l\x1B[?2004l\x1B[<u\x1B[>4;0m";
function reportRestoreFailure(scope, err, reason) {
  const suffix = reason ? ` (${reason})` : "";
  const message = `[terminal] restore ${scope} failed${suffix}: ${String(err)}`;
  try {
    process.stderr.write(`${message}\n`);
  } catch (writeErr) {
    console.error(`[terminal] restore reporting failed${suffix}: ${String(writeErr)}`);
  }
}
function restoreTerminalState(reason, options = {}) {
  const resumeStdin = options.resumeStdinIfPaused ?? options.resumeStdin ?? false;
  try {
    (0, _progressLineXDw3PVgH.t)();
  } catch (err) {
    reportRestoreFailure("progress line", err, reason);
  }
  const stdin = process.stdin;
  if (stdin.isTTY && typeof stdin.setRawMode === "function") {
    try {
      stdin.setRawMode(false);
    } catch (err) {
      reportRestoreFailure("raw mode", err, reason);
    }
    if (resumeStdin && typeof stdin.isPaused === "function" && stdin.isPaused()) try {
      stdin.resume();
    } catch (err) {
      reportRestoreFailure("stdin resume", err, reason);
    }
  }
  if (process.stdout.isTTY) try {
    process.stdout.write(RESET_SEQUENCE);
  } catch (err) {
    reportRestoreFailure("stdout reset", err, reason);
  }
}
//#endregion /* v9-286463df1b309f00 */
