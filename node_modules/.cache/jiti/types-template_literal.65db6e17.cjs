"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.IsTemplateLiteral = IsTemplateLiteral;exports.IsTemplateLiteralDeferred = IsTemplateLiteralDeferred;exports.TemplateLiteral = TemplateLiteral;exports.TemplateLiteralDeferred = TemplateLiteralDeferred;exports.TemplateLiteralFromString = TemplateLiteralFromString;exports.TemplateLiteralFromTypes = TemplateLiteralFromTypes;

var _system = require("../../system/system.mjs");
var _index = require("../../guard/index.mjs");
var _schema = require("./schema.mjs");
var _deferred = require("./deferred.mjs");
var _template = require("../engine/patterns/template.mjs");
var _instantiate = require("../engine/template_literal/instantiate.mjs"); // deno-fmt-ignore-file
// deno-lint-ignore-file
/** Creates a deferred TemplateLiteral action. */function TemplateLiteralDeferred(types, options = {}) {
  return (0, _deferred.Deferred)('TemplateLiteral', [types], options);
}
/** Returns true if this value is a deferred Interface action. */
function IsTemplateLiteralDeferred(value) {
  return (0, _schema.IsSchema)(value) &&
  _index.Guard.HasPropertyKey(value, 'action') &&
  _index.Guard.IsEqual(value.action, 'TemplateLiteral');
}
function TemplateLiteralFromTypes(types) {
  return (0, _instantiate.TemplateLiteralAction)(types, {});
}
function TemplateLiteralFromString(template) {
  const types = (0, _template.ParseTemplateIntoTypes)(template);
  return TemplateLiteralFromTypes(types);
}
/** Creates a TemplateLiteral type. */
function TemplateLiteral(input, options = {}) {
  const type = _index.Guard.IsString(input) ? TemplateLiteralFromString(input) : TemplateLiteralFromTypes(input);
  return _system.Memory.Update(type, {}, options);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
/** Returns true if the given value is TTemplateLiteral. */
function IsTemplateLiteral(value) {
  return (0, _schema.IsKind)(value, 'TemplateLiteral');
} /* v9-83579cc3746e6aed */
