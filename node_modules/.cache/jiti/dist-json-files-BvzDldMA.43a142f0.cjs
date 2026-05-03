"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.a = readJsonFileSync;exports.i = readJsonFile;exports.n = createAsyncLock;exports.o = writeJsonAtomic;exports.r = readDurableJsonFile;exports.s = writeTextAtomic;exports.t = void 0;var _nodeFs = require("node:fs");
var _nodePath = _interopRequireDefault(require("node:path"));
var _promises = _interopRequireDefault(require("node:fs/promises"));
var _nodeCrypto = require("node:crypto");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}
//#region src/infra/json-files.ts
function getErrorCode(err) {
  return err instanceof Error ? err.code : void 0;
}
var JsonFileReadError = class extends Error {
  constructor(filePath, reason, cause) {
    super(`Failed to ${reason} JSON file: ${filePath}`, { cause });
    this.name = "JsonFileReadError";
    this.filePath = filePath;
    this.reason = reason;
  }
};exports.t = JsonFileReadError;
async function replaceFileWithWindowsFallback(tempPath, filePath, mode) {
  try {
    await _promises.default.rename(tempPath, filePath);
    return;
  } catch (err) {
    const code = getErrorCode(err);
    if (process.platform !== "win32" || code !== "EPERM" && code !== "EEXIST") throw err;
  }
  if ((await _promises.default.lstat(filePath).catch(() => null))?.isSymbolicLink()) {
    await _promises.default.rm(filePath, { force: true });
    await _promises.default.rename(tempPath, filePath);
    return;
  }
  await _promises.default.copyFile(tempPath, filePath);
  try {
    await _promises.default.chmod(filePath, mode);
  } catch {}
  await _promises.default.rm(tempPath, { force: true }).catch(() => void 0);
}
async function readJsonFile(filePath) {
  try {
    const raw = await _promises.default.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function readDurableJsonFile(filePath) {
  let raw;
  try {
    raw = await _promises.default.readFile(filePath, "utf8");
  } catch (err) {
    if (getErrorCode(err) === "ENOENT") return null;
    throw new JsonFileReadError(filePath, "read", err);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new JsonFileReadError(filePath, "parse", err);
  }
}
function readJsonFileSync(filePath) {
  try {
    const raw = (0, _nodeFs.readFileSync)(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function writeJsonAtomic(filePath, value, options) {
  await writeTextAtomic(filePath, JSON.stringify(value, null, 2), {
    mode: options?.mode,
    ensureDirMode: options?.ensureDirMode,
    appendTrailingNewline: options?.trailingNewline
  });
}
async function writeTextAtomic(filePath, content, options) {
  const mode = options?.mode ?? 384;
  const payload = options?.appendTrailingNewline && !content.endsWith("\n") ? `${content}\n` : content;
  const mkdirOptions = { recursive: true };
  if (typeof options?.ensureDirMode === "number") mkdirOptions.mode = options.ensureDirMode;
  await _promises.default.mkdir(_nodePath.default.dirname(filePath), mkdirOptions);
  const parentDir = _nodePath.default.dirname(filePath);
  const tmp = `${filePath}.${(0, _nodeCrypto.randomUUID)()}.tmp`;
  try {
    const tmpHandle = await _promises.default.open(tmp, "w", mode);
    try {
      await tmpHandle.writeFile(payload, { encoding: "utf8" });
      await tmpHandle.sync();
    } finally {
      await tmpHandle.close().catch(() => void 0);
    }
    try {
      await _promises.default.chmod(tmp, mode);
    } catch {}
    await replaceFileWithWindowsFallback(tmp, filePath, mode);
    try {
      const dirHandle = await _promises.default.open(parentDir, "r");
      try {
        await dirHandle.sync();
      } finally {
        await dirHandle.close().catch(() => void 0);
      }
    } catch {}
    try {
      await _promises.default.chmod(filePath, mode);
    } catch {}
  } finally {
    await _promises.default.rm(tmp, { force: true }).catch(() => void 0);
  }
}
function createAsyncLock() {
  let lock = Promise.resolve();
  return async function withLock(fn) {
    const prev = lock;
    let release;
    lock = new Promise((resolve) => {
      release = resolve;
    });
    await prev;
    try {
      return await fn();
    } finally {
      release?.();
    }
  };
}
//#endregion /* v9-a291c1292a1a65a2 */
