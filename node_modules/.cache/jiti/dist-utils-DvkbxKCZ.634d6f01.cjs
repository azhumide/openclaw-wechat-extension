"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports._ = sleep;exports.a = displayPath;exports.b = escapeRegExp;exports.c = isRecord;exports.d = resolveConfigDir;exports.f = resolveHomeDir;exports.g = shortenHomePath;exports.h = shortenHomeInString;exports.i = clampNumber;exports.l = normalizeE164;exports.m = safeParseJson;exports.n = void 0;exports.o = displayString;exports.p = resolveUserPath;exports.r = clampInt;exports.s = ensureDir;exports.t = void 0;exports.u = pathExists;exports.v = sliceUtf16Safe;exports.x = isPlainObject;exports.y = truncateUtf16Safe;var _homeDirG5LU3LmA = require("./home-dir-g5LU3LmA.js");
var _nodeFs = _interopRequireDefault(require("node:fs"));
var _nodePath = _interopRequireDefault(require("node:path"));
var _nodeOs = _interopRequireDefault(require("node:os"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}
//#region src/infra/plain-object.ts
/**
* Strict plain-object guard (excludes arrays and host objects).
*/
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.prototype.toString.call(value) === "[object Object]";
}
//#endregion
//#region src/shared/regexp.ts
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
//#endregion
//#region src/utils.ts
async function ensureDir(dir) {
  await _nodeFs.default.promises.mkdir(dir, { recursive: true });
}
/**
* Check if a file or directory exists at the given path.
*/
async function pathExists(targetPath) {
  try {
    await _nodeFs.default.promises.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function clampInt(value, min, max) {
  return clampNumber(Math.floor(value), min, max);
}
/** Alias for clampNumber (shorter, more common name) */
const clamp = exports.n = clampNumber;
/**
* Safely parse JSON, returning null on error instead of throwing.
*/
function safeParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
/**
* Type guard for Record<string, unknown> (less strict than isPlainObject).
* Accepts any non-null object that isn't an array.
*/
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function normalizeE164(number) {
  const digits = number.replace(/^[a-z][a-z0-9-]*:/i, "").trim().replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `+${digits.slice(1)}`;
  return `+${digits}`;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function isHighSurrogate(codeUnit) {
  return codeUnit >= 55296 && codeUnit <= 56319;
}
function isLowSurrogate(codeUnit) {
  return codeUnit >= 56320 && codeUnit <= 57343;
}
function sliceUtf16Safe(input, start, end) {
  const len = input.length;
  let from = start < 0 ? Math.max(len + start, 0) : Math.min(start, len);
  let to = end === void 0 ? len : end < 0 ? Math.max(len + end, 0) : Math.min(end, len);
  if (to < from) {
    const tmp = from;
    from = to;
    to = tmp;
  }
  if (from > 0 && from < len) {
    if (isLowSurrogate(input.charCodeAt(from)) && isHighSurrogate(input.charCodeAt(from - 1))) from += 1;
  }
  if (to > 0 && to < len) {
    if (isHighSurrogate(input.charCodeAt(to - 1)) && isLowSurrogate(input.charCodeAt(to))) to -= 1;
  }
  return input.slice(from, to);
}
function truncateUtf16Safe(input, maxLen) {
  const limit = Math.max(0, Math.floor(maxLen));
  if (input.length <= limit) return input;
  return sliceUtf16Safe(input, 0, limit);
}
function resolveUserPath(input, env = process.env, homedir = _nodeOs.default.homedir) {
  if (!input) return "";
  return (0, _homeDirG5LU3LmA.r)(input, {
    env,
    homedir
  });
}
function resolveConfigDir(env = process.env, homedir = _nodeOs.default.homedir) {
  const override = env.OPENCLAW_STATE_DIR?.trim();
  if (override) return resolveUserPath(override, env, homedir);
  const configPath = env.OPENCLAW_CONFIG_PATH?.trim();
  if (configPath) return _nodePath.default.dirname(resolveUserPath(configPath, env, homedir));
  const newDir = _nodePath.default.join((0, _homeDirG5LU3LmA.o)(env, homedir), ".openclaw");
  try {
    if (_nodeFs.default.existsSync(newDir)) return newDir;
  } catch {}
  return newDir;
}
function resolveHomeDir() {
  return (0, _homeDirG5LU3LmA.n)(process.env, _nodeOs.default.homedir);
}
function resolveHomeDisplayPrefix() {
  const home = resolveHomeDir();
  if (!home) return;
  if (process.env.OPENCLAW_HOME?.trim()) return {
    home,
    prefix: "$OPENCLAW_HOME"
  };
  return {
    home,
    prefix: "~"
  };
}
function shortenHomePath(input) {
  if (!input) return input;
  const display = resolveHomeDisplayPrefix();
  if (!display) return input;
  const { home, prefix } = display;
  if (input === home) return prefix;
  if (input.startsWith(`${home}/`) || input.startsWith(`${home}\\`)) return `${prefix}${input.slice(home.length)}`;
  return input;
}
function shortenHomeInString(input) {
  if (!input) return input;
  const display = resolveHomeDisplayPrefix();
  if (!display) return input;
  return input.split(display.home).join(display.prefix);
}
function displayPath(input) {
  return shortenHomePath(input);
}
function displayString(input) {
  return shortenHomeInString(input);
}
const CONFIG_DIR = exports.t = resolveConfigDir();
//#endregion /* v9-b06017f1875af4cf */
