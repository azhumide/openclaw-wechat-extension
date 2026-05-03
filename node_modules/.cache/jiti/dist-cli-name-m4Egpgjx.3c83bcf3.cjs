"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.n = resolveCliName;exports.t = replaceCliName;var _nodePath = _interopRequireDefault(require("node:path"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}
//#region src/cli/cli-name.ts
const DEFAULT_CLI_NAME = "openclaw";
const KNOWN_CLI_NAMES = new Set([DEFAULT_CLI_NAME]);
const CLI_PREFIX_RE = /^(?:((?:pnpm|npm|bunx|npx)\s+))?(openclaw)\b/;
function resolveCliName(argv = process.argv) {
  const argv1 = argv[1];
  if (!argv1) return DEFAULT_CLI_NAME;
  const base = _nodePath.default.basename(argv1).trim();
  if (KNOWN_CLI_NAMES.has(base)) return base;
  return DEFAULT_CLI_NAME;
}
function replaceCliName(command, cliName = resolveCliName()) {
  if (!command.trim()) return command;
  if (!CLI_PREFIX_RE.test(command)) return command;
  return command.replace(CLI_PREFIX_RE, (_match, runner) => {
    return `${runner ?? ""}${cliName}`;
  });
}
//#endregion /* v9-b561077ade6954d1 */
