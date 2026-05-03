"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.n = registerListener;exports.t = notifyListeners; //#region src/shared/listeners.ts
function notifyListeners(listeners, event, onError) {
  for (const listener of listeners) try {
    listener(event);
  } catch (error) {
    onError?.(error);
  }
}
function registerListener(listeners, listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
//#endregion /* v9-e9dccc54df5479ea */
