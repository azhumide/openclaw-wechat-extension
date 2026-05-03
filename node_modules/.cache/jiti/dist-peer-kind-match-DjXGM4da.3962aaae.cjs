"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.t = peerKindMatches; //#region src/routing/peer-kind-match.ts
function peerKindMatches(bindingKind, scopeKind) {
  if (bindingKind === scopeKind) return true;
  return bindingKind === "group" && scopeKind === "channel" || bindingKind === "channel" && scopeKind === "group";
}
//#endregion /* v9-06cbef4b84805c5f */
