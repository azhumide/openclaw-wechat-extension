"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.t = pruneMapToMaxSize; //#region src/infra/map-size.ts
function pruneMapToMaxSize(map, maxSize) {
  const limit = Math.max(0, Math.floor(maxSize));
  if (limit <= 0) {
    map.clear();
    return;
  }
  while (map.size > limit) {
    const oldest = map.keys().next();
    if (oldest.done) break;
    map.delete(oldest.value);
  }
}
//#endregion /* v9-6cfa85097ebe59af */
