"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.i = setYes;exports.n = isYes;exports.r = setVerbose;exports.t = isVerbose; //#region src/global-state.ts
let globalVerbose = false;
let globalYes = false;
function setVerbose(v) {
  globalVerbose = v;
}
function isVerbose() {
  return globalVerbose;
}
function setYes(v) {
  globalYes = v;
}
function isYes() {
  return globalYes;
}
//#endregion /* v9-d68e71b25a8b29ca */
