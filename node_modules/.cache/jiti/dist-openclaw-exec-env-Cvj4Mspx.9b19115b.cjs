"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.n = markOpenClawExecEnv;exports.t = ensureOpenClawExecMarkerOnProcess; //#region src/infra/openclaw-exec-env.ts
const OPENCLAW_CLI_ENV_VAR = "OPENCLAW_CLI";
function markOpenClawExecEnv(env) {
  return {
    ...env,
    [OPENCLAW_CLI_ENV_VAR]: "1"
  };
}
function ensureOpenClawExecMarkerOnProcess(env = process.env) {
  env[OPENCLAW_CLI_ENV_VAR] = "1";
  return env;
}
//#endregion /* v9-27b15d0d6a61dd16 */
