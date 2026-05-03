"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.n = createStaticReplyToModeResolver;exports.r = createTopLevelChannelReplyToModeResolver;exports.t = createScopedAccountReplyToModeResolver; //#region src/channels/plugins/threading-helpers.ts
function createStaticReplyToModeResolver(mode) {
  return () => mode;
}
function createTopLevelChannelReplyToModeResolver(channelId) {
  return ({ cfg }) => {
    return cfg.channels?.[channelId]?.replyToMode ?? "off";
  };
}
function createScopedAccountReplyToModeResolver(params) {
  return ({ cfg, accountId, chatType }) => params.resolveReplyToMode(params.resolveAccount(cfg, accountId), chatType) ?? params.fallback ?? "off";
}
//#endregion /* v9-6c9d5950f0ec19b0 */
