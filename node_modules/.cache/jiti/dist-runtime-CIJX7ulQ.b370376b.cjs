"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.n = void 0;exports.r = writeRuntimeJson;exports.t = createNonExitingRuntime;var _progressLineBLlwPNs = require("./progress-line-BLlwPNs4.js");
var _restoreJDEjQYEl = require("./restore-JDEjQYEl.js");
//#region src/runtime.ts
function shouldEmitRuntimeLog(env = process.env) {
  if (env.VITEST !== "true") return true;
  if (env.OPENCLAW_TEST_RUNTIME_LOG === "1") return true;
  return typeof console.log.mock === "object";
}
function shouldEmitRuntimeStdout(env = process.env) {
  if (env.VITEST !== "true") return true;
  if (env.OPENCLAW_TEST_RUNTIME_LOG === "1") return true;
  return typeof process.stdout.write.mock === "object";
}
function isPipeClosedError(err) {
  const code = err?.code;
  return code === "EPIPE" || code === "EIO";
}
function hasRuntimeOutputWriter(runtime) {
  return typeof runtime.writeStdout === "function";
}
function writeStdout(value) {
  if (!shouldEmitRuntimeStdout()) return;
  (0, _progressLineBLlwPNs.t)();
  const line = value.endsWith("\n") ? value : `${value}\n`;
  try {
    process.stdout.write(line);
  } catch (err) {
    if (isPipeClosedError(err)) return;
    throw err;
  }
}
function createRuntimeIo() {
  return {
    log: (...args) => {
      if (!shouldEmitRuntimeLog()) return;
      (0, _progressLineBLlwPNs.t)();
      console.log(...args);
    },
    error: (...args) => {
      (0, _progressLineBLlwPNs.t)();
      console.error(...args);
    },
    writeStdout,
    writeJson: (value, space = 2) => {
      writeStdout(JSON.stringify(value, null, space > 0 ? space : void 0));
    }
  };
}
const defaultRuntime = exports.n = {
  ...createRuntimeIo(),
  exit: (code) => {
    (0, _restoreJDEjQYEl.t)("runtime exit", { resumeStdinIfPaused: false });
    process.exit(code);
    throw new Error("unreachable");
  }
};
function createNonExitingRuntime() {
  return {
    ...createRuntimeIo(),
    exit: (code) => {
      throw new Error(`exit ${code}`);
    }
  };
}
function writeRuntimeJson(runtime, value, space = 2) {
  if (hasRuntimeOutputWriter(runtime)) {
    runtime.writeJson(value, space);
    return;
  }
  runtime.log(JSON.stringify(value, null, space > 0 ? space : void 0));
}
//#endregion /* v9-67566931e65dedb2 */
