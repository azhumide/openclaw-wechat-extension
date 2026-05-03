"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ReadonlyObject = ReadonlyObject;exports.ReadonlyObjectDeferred = ReadonlyObjectDeferred;exports.ReadonlyType = void 0;
var _deferred = require("../types/deferred.mjs");
var _instantiate = require("../engine/readonly_object/instantiate.mjs"); // deno-fmt-ignore-file
/** Creates a deferred ReadonlyType action. */
function ReadonlyObjectDeferred(type, options = {}) {
  return (0, _deferred.Deferred)('ReadonlyObject', [type], options);
}
/** This type is an alias for TypeScript's `Readonly<T>` utility type. It will make all properties of a TObject readonly or marks an TArray or TTuple as immutable `readonly T[]`. */
function ReadonlyObject(type, options = {}) {
  return (0, _instantiate.ReadonlyObjectAction)(type, options);
}
/**
 * This type has been renamed to ReadonlyObject.
 * @deprecated
*/
const ReadonlyType = exports.ReadonlyType = ReadonlyObject; /* v9-d0f9dc457fd399c0 */
