"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Match = Match; /**
 * Match arguments for overloaded functions that use the `...args: unknown[]` pattern. Arguments
 * are parsed using argument length only.
 */
function Match(args, match) {
  return match[args.length]?.(...args) ?? (() => {
    throw Error('Invalid Arguments');
  })();
} /* v9-2aa3a498a748278c */
