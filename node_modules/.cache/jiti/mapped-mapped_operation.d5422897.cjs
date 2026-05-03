"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.MappedOperation = MappedOperation;

var _index = require("../../../system/memory/index.mjs");
var _literal = require("../../types/literal.mjs");
var _object = require("../../types/object.mjs");
var _template_literal = require("../../types/template_literal.mjs");
var _decode = require("../template_literal/decode.mjs");
var _instantiate = require("../instantiate.mjs");
var _index2 = require("../evaluate/index.mjs");
var _mapped_variants = require("./mapped_variants.mjs"); // deno-lint-ignore-file ban-types
// deno-fmt-ignore-file
function CanonicalAs(instantiatedAs) {const result = (0, _template_literal.IsTemplateLiteral)(instantiatedAs) ?
  (0, _decode.TemplateLiteralDecode)(instantiatedAs.pattern) :
  instantiatedAs;
  return result;
}
function MappedVariant(context, state, identifier, variant, as, property) {
  const variantContext = _index.Memory.Assign(context, { [identifier['name']]: variant });
  const instantiatedAs = (0, _instantiate.InstantiateType)(variantContext, state, as);
  const canonicalAs = CanonicalAs(instantiatedAs);
  const instantiatedProperty = (0, _instantiate.InstantiateType)(variantContext, state, property);
  return (0, _literal.IsLiteralNumber)(canonicalAs) || (0, _literal.IsLiteralString)(canonicalAs) ?
  { [canonicalAs.const]: instantiatedProperty } :
  {};
}
function MappedProperties(context, state, identifier, variants, as, property) {
  return variants.reduce((result, left) => {
    return [...result, MappedVariant(context, state, identifier, left, as, property)];
  }, []);
}
function MappedObjects(properties) {
  return properties.reduce((result, left) => {
    return [...result, (0, _object.Object)(left)];
  }, []);
}
function MappedOperation(context, state, identifier, type, as, property) {
  const variants = (0, _mapped_variants.MappedVariants)(type);
  const mappedProperties = MappedProperties(context, state, identifier, variants, as, property);
  const mappedObjects = MappedObjects(mappedProperties);
  const result = (0, _index2.EvaluateIntersect)(mappedObjects);
  return result;
} /* v9-141aff467efb1844 */
