"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.a = resolvePreferredAccountId;exports.i = resolveDefaultAgentBoundAccountId;exports.n = listBindings;exports.r = listBoundAccountIds;exports.t = buildChannelAccountBindings;var _sessionKeyC6FNnIG = require("./session-key-C6F-NnIG.js");
var _agentScopeRNt6KatQ = require("./agent-scope-RNt6KatQ.js");
var _bindingsCR3ZsOC = require("./bindings-CR3ZsOC9.js");
var _bindingScopeRJ1r7OuN = require("./binding-scope-RJ1r7OuN.js");
//#region src/routing/bindings.ts
function listBindings(cfg) {
  return (0, _bindingsCR3ZsOC.i)(cfg);
}
function listBoundAccountIds(cfg, channelId) {
  const normalizedChannel = (0, _bindingScopeRJ1r7OuN.t)(channelId);
  if (!normalizedChannel) return [];
  const ids = /* @__PURE__ */new Set();
  for (const binding of listBindings(cfg)) {
    const resolved = (0, _bindingScopeRJ1r7OuN.i)(binding);
    if (!resolved || resolved.channelId !== normalizedChannel) continue;
    ids.add(resolved.accountId);
  }
  return Array.from(ids).toSorted((a, b) => a.localeCompare(b));
}
function resolveDefaultAgentBoundAccountId(cfg, channelId) {
  const normalizedChannel = (0, _bindingScopeRJ1r7OuN.t)(channelId);
  if (!normalizedChannel) return null;
  const defaultAgentId = (0, _sessionKeyC6FNnIG.c)((0, _agentScopeRNt6KatQ.S)(cfg));
  for (const binding of listBindings(cfg)) {
    const resolved = (0, _bindingScopeRJ1r7OuN.i)(binding);
    if (!resolved || resolved.channelId !== normalizedChannel || resolved.agentId !== defaultAgentId) continue;
    return resolved.accountId;
  }
  return null;
}
function buildChannelAccountBindings(cfg) {
  const map = /* @__PURE__ */new Map();
  for (const binding of listBindings(cfg)) {
    const resolved = (0, _bindingScopeRJ1r7OuN.i)(binding);
    if (!resolved) continue;
    const byAgent = map.get(resolved.channelId) ?? /* @__PURE__ */new Map();
    const list = byAgent.get(resolved.agentId) ?? [];
    if (!list.includes(resolved.accountId)) list.push(resolved.accountId);
    byAgent.set(resolved.agentId, list);
    map.set(resolved.channelId, byAgent);
  }
  return map;
}
function resolvePreferredAccountId(params) {
  if (params.boundAccounts.length > 0) return params.boundAccounts[0];
  return params.defaultAccountId;
}
//#endregion /* v9-adaf86773dd30959 */
