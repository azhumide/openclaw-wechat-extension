"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.n = resolveOpenClawPackageRootSync;exports.t = resolveOpenClawPackageRoot;var _nodeUrl = require("node:url");
var _nodeFs = _interopRequireDefault(require("node:fs"));
var _nodePath = _interopRequireDefault(require("node:path"));
var _promises = _interopRequireDefault(require("node:fs/promises"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}
//#region src/infra/openclaw-root.ts
const CORE_PACKAGE_NAMES = new Set(["openclaw"]);
function parsePackageName(raw) {
  const parsed = JSON.parse(raw);
  return typeof parsed.name === "string" ? parsed.name : null;
}
async function readPackageName(dir) {
  try {
    return parsePackageName(await _promises.default.readFile(_nodePath.default.join(dir, "package.json"), "utf-8"));
  } catch {
    return null;
  }
}
function readPackageNameSync(dir) {
  try {
    return parsePackageName(_nodeFs.default.readFileSync(_nodePath.default.join(dir, "package.json"), "utf-8"));
  } catch {
    return null;
  }
}
async function findPackageRoot(startDir, maxDepth = 12) {
  for (const current of iterAncestorDirs(startDir, maxDepth)) {
    const name = await readPackageName(current);
    if (name && CORE_PACKAGE_NAMES.has(name)) return current;
  }
  return null;
}
function findPackageRootSync(startDir, maxDepth = 12) {
  for (const current of iterAncestorDirs(startDir, maxDepth)) {
    const name = readPackageNameSync(current);
    if (name && CORE_PACKAGE_NAMES.has(name)) return current;
  }
  return null;
}
function* iterAncestorDirs(startDir, maxDepth) {
  let current = _nodePath.default.resolve(startDir);
  for (let i = 0; i < maxDepth; i += 1) {
    yield current;
    const parent = _nodePath.default.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}
function candidateDirsFromArgv1(argv1) {
  const normalized = _nodePath.default.resolve(argv1);
  const candidates = [_nodePath.default.dirname(normalized)];
  try {
    const resolved = _nodeFs.default.realpathSync(normalized);
    if (resolved !== normalized) candidates.push(_nodePath.default.dirname(resolved));
  } catch {}
  const parts = normalized.split(_nodePath.default.sep);
  const binIndex = parts.lastIndexOf(".bin");
  if (binIndex > 0 && parts[binIndex - 1] === "node_modules") {
    const binName = _nodePath.default.basename(normalized);
    const nodeModulesDir = parts.slice(0, binIndex).join(_nodePath.default.sep);
    candidates.push(_nodePath.default.join(nodeModulesDir, binName));
  }
  return candidates;
}
async function resolveOpenClawPackageRoot(opts) {
  for (const candidate of buildCandidates(opts)) {
    const found = await findPackageRoot(candidate);
    if (found) return found;
  }
  return null;
}
function resolveOpenClawPackageRootSync(opts) {
  for (const candidate of buildCandidates(opts)) {
    const found = findPackageRootSync(candidate);
    if (found) return found;
  }
  return null;
}
function buildCandidates(opts) {
  const candidates = [];
  if (opts.moduleUrl) try {
    candidates.push(_nodePath.default.dirname((0, _nodeUrl.fileURLToPath)(opts.moduleUrl)));
  } catch {}
  if (opts.argv1) candidates.push(...candidateDirsFromArgv1(opts.argv1));
  if (opts.cwd) candidates.push(opts.cwd);
  return candidates;
}
//#endregion /* v9-f20d1c88e7ce9873 */
