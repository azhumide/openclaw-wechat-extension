"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.t = buildOutboundBaseSessionKey;var _resolveRouteBBcZvIS = require("./resolve-route-B-BcZvIS.js");
//#region src/infra/outbound/base-session-key.ts
function buildOutboundBaseSessionKey(params) {
  return (0, _resolveRouteBBcZvIS.t)({
    agentId: params.agentId,
    channel: params.channel,
    accountId: params.accountId,
    peer: params.peer,
    dmScope: params.cfg.session?.dmScope ?? "main",
    identityLinks: params.cfg.session?.identityLinks
  });
}
//#endregion /* v9-655aabb14b584123 */
