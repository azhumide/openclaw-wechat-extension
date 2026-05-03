"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.a = resolveCanonicalRootMemoryPath;exports.c = shouldSkipRootMemoryAuxiliaryPath;exports.i = resolveCanonicalRootMemoryFile;exports.n = void 0;exports.o = resolveLegacyRootMemoryPath;exports.r = exactWorkspaceEntryExists;exports.s = resolveRootMemoryRepairDir;exports.t = void 0;var _nodePath = _interopRequireDefault(require("node:path"));
var _promises = _interopRequireDefault(require("node:fs/promises"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}
//#region src/memory/root-memory-files.ts
const CANONICAL_ROOT_MEMORY_FILENAME = exports.t = "MEMORY.md";
const LEGACY_ROOT_MEMORY_FILENAME = exports.n = "memory.md";
function resolveCanonicalRootMemoryPath(workspaceDir) {
  return _nodePath.default.join(workspaceDir, CANONICAL_ROOT_MEMORY_FILENAME);
}
function resolveLegacyRootMemoryPath(workspaceDir) {
  return _nodePath.default.join(workspaceDir, LEGACY_ROOT_MEMORY_FILENAME);
}
function resolveRootMemoryRepairDir(workspaceDir) {
  return _nodePath.default.join(workspaceDir, ".openclaw-repair", "root-memory");
}
function normalizeWorkspaceRelativePath(value) {
  return value.trim().replace(/\\/g, "/").replace(/^\.\//, "");
}
async function exactWorkspaceEntryExists(dir, name) {
  try {
    return (await _promises.default.readdir(dir)).includes(name);
  } catch {
    return false;
  }
}
async function resolveCanonicalRootMemoryFile(workspaceDir) {
  try {
    const entries = await _promises.default.readdir(workspaceDir, { withFileTypes: true });
    for (const entry of entries) if (entry.name === "MEMORY.md" && entry.isFile() && !entry.isSymbolicLink()) return _nodePath.default.join(workspaceDir, entry.name);
  } catch {}
  return null;
}
function shouldSkipRootMemoryAuxiliaryPath(params) {
  const relative = _nodePath.default.relative(params.workspaceDir, params.absPath);
  if (relative.startsWith("..") || _nodePath.default.isAbsolute(relative)) return false;
  const normalized = normalizeWorkspaceRelativePath(relative);
  return normalized === "memory.md" || normalized === ".openclaw-repair/root-memory" || normalized.startsWith(`.openclaw-repair/root-memory/`);
}
//#endregion /* v9-7ccad13c1ec6f29b */
