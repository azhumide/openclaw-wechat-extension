"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.CanEvaluate = CanEvaluate;exports.Evaluate = Evaluate;var _index = require("../settings/index.mjs");
var _index2 = require("../../guard/index.mjs");
let supported = undefined;
// ------------------------------------------------------------------
// TryEvaluate
// ------------------------------------------------------------------
function TryEvaluate() {
  try {
    Evaluate('null')();
    return true;
  } // deno-coverage-ignore-start - unreachable in test-suite
  catch {
    return false;
  }
  // deno-coverage-ignore-stop
}
// ------------------------------------------------------------------
// CanEvaluate
// ------------------------------------------------------------------
/** Returns true if the environment supports dynamic JavaScript evaluation */
function CanEvaluate() {
  if (_index2.Guard.IsUndefined(supported))
  supported = TryEvaluate();
  return supported && _index.Settings.Get().useAcceleration;
}
// ------------------------------------------------------------------
// Evaluate
// ------------------------------------------------------------------
/**
 * Evaluates code in the current environment. This function will throw if the
 * environment Content-Security-Policy does not support `unsafe-eval`. Use the
 * Environment.CanEvaluate() to determine if the environment supports Evaluate
 * before calling this function.
 */
function Evaluate(...args) {
  return new globalThis.Function(...args);
} /* v9-eb80675026c0267d */
