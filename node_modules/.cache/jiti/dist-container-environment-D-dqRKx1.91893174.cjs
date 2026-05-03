"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.t = isContainerEnvironment;var _nodeFs = _interopRequireDefault(require("node:fs"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}
//#region src/infra/container-environment.ts
/**
* Detect whether the current process is running inside a container
* (Docker, Podman, or Kubernetes).
*
* Uses two reliable heuristics:
* - Presence of common container sentinel files.
* - Container-related entries in /proc/1/cgroup.
*
* The result is cached after the first call so filesystem access happens at
* most once per process lifetime.
*/
let containerEnvironmentCache;
function isContainerEnvironment() {
  if (containerEnvironmentCache !== void 0) return containerEnvironmentCache;
  containerEnvironmentCache = detectContainerEnvironment();
  return containerEnvironmentCache;
}
function detectContainerEnvironment() {
  for (const sentinelPath of [
  "/.dockerenv",
  "/run/.containerenv",
  "/var/run/.containerenv"])
  try {
    _nodeFs.default.accessSync(sentinelPath, _nodeFs.default.constants.F_OK);
    return true;
  } catch {}
  try {
    const cgroup = _nodeFs.default.readFileSync("/proc/1/cgroup", "utf8");
    if (/\/docker\/|cri-containerd-[0-9a-f]|containerd\/[0-9a-f]{64}|\/kubepods[/.]|\blxc\b/.test(cgroup)) return true;
  } catch {}
  return false;
}
//#endregion /* v9-3806b42bfbd4c616 */
