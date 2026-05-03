"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.defaultMessages = exports.EndOfStreamError = exports.AbortError = void 0;const defaultMessages = exports.defaultMessages = 'End-Of-Stream';
/**
 * Thrown on read operation of the end of file or stream has been reached
 */
class EndOfStreamError extends Error {
  constructor() {
    super(defaultMessages);
    this.name = "EndOfStreamError";
  }
}exports.EndOfStreamError = EndOfStreamError;
class AbortError extends Error {
  constructor(message = "The operation was aborted") {
    super(message);
    this.name = "AbortError";
  }
}exports.AbortError = AbortError; /* v9-21c44e1bd420d7b0 */
