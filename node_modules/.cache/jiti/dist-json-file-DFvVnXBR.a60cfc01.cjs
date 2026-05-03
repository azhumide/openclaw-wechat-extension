"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.n = saveJsonFile;exports.t = loadJsonFile;var _nodeFs = _interopRequireDefault(require("node:fs"));
var _nodePath = _interopRequireDefault(require("node:path"));
var _nodeCrypto = require("node:crypto");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}
//#region src/infra/json-file.ts
const JSON_FILE_MODE = 384;
const JSON_DIR_MODE = 448;
function trySetSecureMode(pathname) {
  try {
    _nodeFs.default.chmodSync(pathname, JSON_FILE_MODE);
  } catch {}
}
function trySyncDirectory(pathname) {
  let fd;
  try {
    fd = _nodeFs.default.openSync(_nodePath.default.dirname(pathname), "r");
    _nodeFs.default.fsyncSync(fd);
  } catch {} finally {
    if (fd !== void 0) try {
      _nodeFs.default.closeSync(fd);
    } catch {}
  }
}
function readSymlinkTargetPath(linkPath) {
  const target = _nodeFs.default.readlinkSync(linkPath);
  return _nodePath.default.resolve(_nodePath.default.dirname(linkPath), target);
}
function resolveJsonWriteTarget(pathname) {
  let currentPath = pathname;
  const visited = /* @__PURE__ */new Set();
  let followsSymlink = false;
  for (;;) {
    let stat;
    try {
      stat = _nodeFs.default.lstatSync(currentPath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      return {
        targetPath: currentPath,
        followsSymlink
      };
    }
    if (!stat.isSymbolicLink()) return {
      targetPath: currentPath,
      followsSymlink
    };
    if (visited.has(currentPath)) {
      const err = /* @__PURE__ */new Error(`Too many symlink levels while resolving ${pathname}`);
      err.code = "ELOOP";
      throw err;
    }
    visited.add(currentPath);
    followsSymlink = true;
    currentPath = readSymlinkTargetPath(currentPath);
  }
}
function renameJsonFileWithFallback(tmpPath, pathname) {
  try {
    _nodeFs.default.renameSync(tmpPath, pathname);
    return;
  } catch (error) {
    const code = error.code;
    if (code === "EPERM" || code === "EEXIST") {
      _nodeFs.default.copyFileSync(tmpPath, pathname);
      _nodeFs.default.rmSync(tmpPath, { force: true });
      return;
    }
    throw error;
  }
}
function writeTempJsonFile(pathname, payload) {
  const fd = _nodeFs.default.openSync(pathname, "w", JSON_FILE_MODE);
  try {
    _nodeFs.default.writeFileSync(fd, payload, "utf8");
    _nodeFs.default.fsyncSync(fd);
  } finally {
    _nodeFs.default.closeSync(fd);
  }
}
function loadJsonFile(pathname) {
  try {
    const raw = _nodeFs.default.readFileSync(pathname, "utf8");
    return JSON.parse(raw);
  } catch {
    return;
  }
}
function saveJsonFile(pathname, data) {
  const { targetPath, followsSymlink } = resolveJsonWriteTarget(pathname);
  const tmpPath = `${targetPath}.${(0, _nodeCrypto.randomUUID)()}.tmp`;
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  if (!followsSymlink) _nodeFs.default.mkdirSync(_nodePath.default.dirname(targetPath), {
    recursive: true,
    mode: JSON_DIR_MODE
  });
  try {
    writeTempJsonFile(tmpPath, payload);
    trySetSecureMode(tmpPath);
    renameJsonFileWithFallback(tmpPath, targetPath);
    trySetSecureMode(targetPath);
    trySyncDirectory(targetPath);
  } finally {
    try {
      _nodeFs.default.rmSync(tmpPath, { force: true });
    } catch {}
  }
}
//#endregion /* v9-8b6d8db765c70a63 */
