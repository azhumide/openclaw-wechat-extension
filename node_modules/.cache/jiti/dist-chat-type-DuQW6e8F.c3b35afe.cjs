"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.t = normalizeChatType;var _stringCoerceBje8XVt = require("./string-coerce-Bje8XVt9.js");
//#region src/channels/chat-type.ts
function normalizeChatType(raw) {
  const value = (0, _stringCoerceBje8XVt.s)(raw);
  if (!value) return;
  if (value === "direct" || value === "dm") return "direct";
  if (value === "group") return "group";
  if (value === "channel") return "channel";
}
//#endregion /* v9-53de6d2e83b00350 */
