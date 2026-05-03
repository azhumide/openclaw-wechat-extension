"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.BaseMapping = BaseMapping;exports.ConstructorMapping = ConstructorMapping;exports.ElementBaseMapping = ElementBaseMapping;exports.ElementListMapping = ElementListMapping;exports.ElementMapping = ElementMapping;exports.ElementNamedMapping = ElementNamedMapping;exports.ElementOptionalMapping = ElementOptionalMapping;exports.ElementReadonlyMapping = ElementReadonlyMapping;exports.ElementReadonlyOptionalMapping = ElementReadonlyOptionalMapping;exports.ExportKeywordMapping = ExportKeywordMapping;exports.ExprMapping = ExprMapping;exports.ExprPipeMapping = ExprPipeMapping;exports.ExprReadonlyMapping = ExprReadonlyMapping;exports.ExprTailMapping = ExprTailMapping;exports.ExprTermMapping = ExprTermMapping;exports.ExprTermTailMapping = ExprTermTailMapping;exports.ExtendsMapping = ExtendsMapping;exports.FactorMapping = FactorMapping;exports.GenericCallArgumentListMapping = GenericCallArgumentListMapping;exports.GenericCallArgumentsMapping = GenericCallArgumentsMapping;exports.GenericCallMapping = GenericCallMapping;exports.GenericParameterEqualsMapping = GenericParameterEqualsMapping;exports.GenericParameterExtendsEqualsMapping = GenericParameterExtendsEqualsMapping;exports.GenericParameterExtendsMapping = GenericParameterExtendsMapping;exports.GenericParameterIdentifierMapping = GenericParameterIdentifierMapping;exports.GenericParameterListMapping = GenericParameterListMapping;exports.GenericParameterMapping = GenericParameterMapping;exports.GenericParametersMapping = GenericParametersMapping;exports.GenericTypeMapping = GenericTypeMapping;exports.IndexArrayMapping = IndexArrayMapping;exports.InferTypeMapping = InferTypeMapping;exports.InterfaceDeclarationGenericMapping = InterfaceDeclarationGenericMapping;exports.InterfaceDeclarationHeritageListMapping = InterfaceDeclarationHeritageListMapping;exports.InterfaceDeclarationHeritageMapping = InterfaceDeclarationHeritageMapping;exports.InterfaceDeclarationMapping = InterfaceDeclarationMapping;exports.JsonArrayMapping = JsonArrayMapping;exports.JsonBooleanMapping = JsonBooleanMapping;exports.JsonElementListMapping = JsonElementListMapping;exports.JsonMapping = JsonMapping;exports.JsonNullMapping = JsonNullMapping;exports.JsonNumberMapping = JsonNumberMapping;exports.JsonObjectMapping = JsonObjectMapping;exports.JsonPropertyListMapping = JsonPropertyListMapping;exports.JsonPropertyMapping = JsonPropertyMapping;exports.JsonStringMapping = JsonStringMapping;exports.KeyOfMapping = KeyOfMapping;exports.KeywordAnyMapping = KeywordAnyMapping;exports.KeywordBigIntMapping = KeywordBigIntMapping;exports.KeywordBooleanMapping = KeywordBooleanMapping;exports.KeywordIntegerMapping = KeywordIntegerMapping;exports.KeywordMapping = KeywordMapping;exports.KeywordNeverMapping = KeywordNeverMapping;exports.KeywordNullMapping = KeywordNullMapping;exports.KeywordNumberMapping = KeywordNumberMapping;exports.KeywordObjectMapping = KeywordObjectMapping;exports.KeywordStringMapping = KeywordStringMapping;exports.KeywordSymbolMapping = KeywordSymbolMapping;exports.KeywordThisMapping = KeywordThisMapping;exports.KeywordUndefinedMapping = KeywordUndefinedMapping;exports.KeywordUnknownMapping = KeywordUnknownMapping;exports.KeywordVoidMapping = KeywordVoidMapping;exports.LiteralBigIntMapping = LiteralBigIntMapping;exports.LiteralBooleanMapping = LiteralBooleanMapping;exports.LiteralMapping = LiteralMapping;exports.LiteralNumberMapping = LiteralNumberMapping;exports.LiteralStringMapping = LiteralStringMapping;exports.MappedAsMapping = MappedAsMapping;exports.MappedMapping = MappedMapping;exports.MappedOptionalMapping = MappedOptionalMapping;exports.MappedReadonlyMapping = MappedReadonlyMapping;exports.ModuleDeclarationDelimiterMapping = ModuleDeclarationDelimiterMapping;exports.ModuleDeclarationListMapping = ModuleDeclarationListMapping;exports.ModuleDeclarationMapping = ModuleDeclarationMapping;exports.ModuleMapping = ModuleMapping;exports.OptionalMapping = OptionalMapping;exports.OptionalSemiColonMapping = OptionalSemiColonMapping;exports.OptionsMapping = OptionsMapping;exports.ParameterBaseMapping = ParameterBaseMapping;exports.ParameterListMapping = ParameterListMapping;exports.ParameterMapping = ParameterMapping;exports.ParameterOptionalMapping = ParameterOptionalMapping;exports.ParameterReadonlyMapping = ParameterReadonlyMapping;exports.ParameterReadonlyOptionalMapping = ParameterReadonlyOptionalMapping;exports.ParameterTypeMapping = ParameterTypeMapping;exports.PatternBaseMapping = PatternBaseMapping;exports.PatternBigIntMapping = PatternBigIntMapping;exports.PatternBodyMapping = PatternBodyMapping;exports.PatternGroupMapping = PatternGroupMapping;exports.PatternIntegerMapping = PatternIntegerMapping;exports.PatternMapping = PatternMapping;exports.PatternNeverMapping = PatternNeverMapping;exports.PatternNumberMapping = PatternNumberMapping;exports.PatternStringMapping = PatternStringMapping;exports.PatternTermMapping = PatternTermMapping;exports.PatternTextMapping = PatternTextMapping;exports.PatternUnionMapping = PatternUnionMapping;exports.PropertiesMapping = PropertiesMapping;exports.PropertyDelimiterMapping = PropertyDelimiterMapping;exports.PropertyKeyIdentMapping = PropertyKeyIdentMapping;exports.PropertyKeyIndexMapping = PropertyKeyIndexMapping;exports.PropertyKeyMapping = PropertyKeyMapping;exports.PropertyKeyNumberMapping = PropertyKeyNumberMapping;exports.PropertyKeyQuotedMapping = PropertyKeyQuotedMapping;exports.PropertyListMapping = PropertyListMapping;exports.PropertyMapping = PropertyMapping;exports.ReadonlyMapping = ReadonlyMapping;exports.ReferenceMapping = ReferenceMapping;exports.ScriptMapping = ScriptMapping;exports.TemplateBodyMapping = TemplateBodyMapping;exports.TemplateInterpolateMapping = TemplateInterpolateMapping;exports.TemplateLiteralMapping = TemplateLiteralMapping;exports.TemplateLiteralTypesMapping = TemplateLiteralTypesMapping;exports.TemplateSpanMapping = TemplateSpanMapping;exports.TupleMapping = TupleMapping;exports.TypeAliasDeclarationGenericMapping = TypeAliasDeclarationGenericMapping;exports.TypeAliasDeclarationMapping = TypeAliasDeclarationMapping;exports.TypeMapping = TypeMapping;exports._Function_Mapping = _Function_Mapping;exports._Object_Mapping = _Object_Mapping;

var _index = require("../../system/memory/index.mjs");
var _index2 = require("../../guard/index.mjs");
var C = _interopRequireWildcard(require("../action/index.mjs"));
var T = _interopRequireWildcard(require("../types/index.mjs"));function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);} // deno-fmt-ignore-file
// deno-lint-ignore-file
function IntrinsicOrCall(ref, parameters) {// deno-coverage-ignore-start
  //
  // Have extensively tested but reports show no Omit coverage (review)
  return _index2.Guard.IsEqual(ref, 'Array') ? T.Array(parameters[0]) :
  _index2.Guard.IsEqual(ref, 'AsyncIterator') ? T.AsyncIterator(parameters[0]) :
  _index2.Guard.IsEqual(ref, 'Iterator') ? T.Iterator(parameters[0]) :
  _index2.Guard.IsEqual(ref, 'Promise') ? T.Promise(parameters[0]) :
  _index2.Guard.IsEqual(ref, 'Awaited') ? C.AwaitedDeferred(parameters[0]) :
  _index2.Guard.IsEqual(ref, 'Capitalize') ? C.CapitalizeDeferred(parameters[0]) :
  _index2.Guard.IsEqual(ref, 'ConstructorParameters') ? C.ConstructorParametersDeferred(parameters[0]) :
  _index2.Guard.IsEqual(ref, 'Evaluate') ? C.EvaluateDeferred(parameters[0]) :
  _index2.Guard.IsEqual(ref, 'Exclude') ? C.ExcludeDeferred(parameters[0], parameters[1]) :
  _index2.Guard.IsEqual(ref, 'Extract') ? C.ExtractDeferred(parameters[0], parameters[1]) :
  _index2.Guard.IsEqual(ref, 'Index') ? C.IndexDeferred(parameters[0], parameters[1]) :
  _index2.Guard.IsEqual(ref, 'InstanceType') ? C.InstanceTypeDeferred(parameters[0]) :
  _index2.Guard.IsEqual(ref, 'Lowercase') ? C.LowercaseDeferred(parameters[0]) :
  _index2.Guard.IsEqual(ref, 'NonNullable') ? C.NonNullableDeferred(parameters[0]) :
  _index2.Guard.IsEqual(ref, 'Omit') ? C.OmitDeferred(parameters[0], parameters[1]) :
  _index2.Guard.IsEqual(ref, 'Options') ? C.OptionsDeferred(parameters[0], parameters[1]) :
  _index2.Guard.IsEqual(ref, 'Parameters') ? C.ParametersDeferred(parameters[0]) :
  _index2.Guard.IsEqual(ref, 'Partial') ? C.PartialDeferred(parameters[0]) :
  _index2.Guard.IsEqual(ref, 'Pick') ? C.PickDeferred(parameters[0], parameters[1]) :
  _index2.Guard.IsEqual(ref, 'Readonly') ? C.ReadonlyObjectDeferred(parameters[0]) :
  _index2.Guard.IsEqual(ref, 'KeyOf') ? C.KeyOfDeferred(parameters[0]) :
  _index2.Guard.IsEqual(ref, 'Record') ? T.RecordDeferred(parameters[0], parameters[1]) :
  _index2.Guard.IsEqual(ref, 'Required') ? C.RequiredDeferred(parameters[0]) :
  _index2.Guard.IsEqual(ref, 'ReturnType') ? C.ReturnTypeDeferred(parameters[0]) :
  _index2.Guard.IsEqual(ref, 'Uncapitalize') ? C.UncapitalizeDeferred(parameters[0]) :
  _index2.Guard.IsEqual(ref, 'Uppercase') ? C.UppercaseDeferred(parameters[0]) :
  T.CallConstruct(T.Ref(ref), parameters);
  // deno-coverage-ignore-stop
}
// ------------------------------------------------------------------
// Unreachable
// ------------------------------------------------------------------
// deno-coverage-ignore-start
function Unreachable() {
  throw Error('Unreachable');
}
const DelimitedDecode = (input, result = []) => {
  return input.reduce((result, left) => {
    return _index2.Guard.IsArray(left) && _index2.Guard.IsEqual(left.length, 2) ?
    [...result, left[0]] :
    [...result, left];
  }, []);
};
const Delimited = (input) => {
  const [left, right] = input;
  return DelimitedDecode([...left, ...right]);
};
function GenericParameterExtendsEqualsMapping(input) {
  return T.Parameter(input[0], input[2], input[4]);
}
function GenericParameterExtendsMapping(input) {
  return T.Parameter(input[0], input[2], input[2]);
}
function GenericParameterEqualsMapping(input) {
  return T.Parameter(input[0], T.Unknown(), input[2]);
}
function GenericParameterIdentifierMapping(input) {
  return T.Parameter(input, T.Unknown(), T.Unknown());
}
function GenericParameterMapping(input) {
  return input;
}
function GenericParameterListMapping(input) {
  return Delimited(input);
}
function GenericParametersMapping(input) {
  return input[1];
}
function GenericCallArgumentListMapping(input) {
  return Delimited(input);
}
function GenericCallArgumentsMapping(input) {
  return input[1];
}
function GenericCallMapping(input) {
  return IntrinsicOrCall(input[0], input[1]);
}
function OptionalSemiColonMapping(input) {
  return null;
}
function KeywordStringMapping(input) {
  return T.String();
}
function KeywordNumberMapping(input) {
  return T.Number();
}
function KeywordBooleanMapping(input) {
  return T.Boolean();
}
function KeywordUndefinedMapping(input) {
  return T.Undefined();
}
function KeywordNullMapping(input) {
  return T.Null();
}
function KeywordIntegerMapping(input) {
  return T.Integer();
}
function KeywordBigIntMapping(input) {
  return T.BigInt();
}
function KeywordUnknownMapping(input) {
  return T.Unknown();
}
function KeywordAnyMapping(input) {
  return T.Any();
}
function KeywordObjectMapping(input) {
  return T.Object({});
}
function KeywordNeverMapping(input) {
  return T.Never();
}
function KeywordSymbolMapping(input) {
  return T.Symbol();
}
function KeywordVoidMapping(input) {
  return T.Void();
}
function KeywordThisMapping(input) {
  return T.This();
}
function KeywordMapping(input) {
  return input;
}
function TemplateInterpolateMapping(input) {
  return input[1];
}
function TemplateSpanMapping(input) {
  return T.Literal(input);
}
function TemplateBodyMapping(input) {
  return _index2.Guard.IsEqual(input.length, 3) ?
  [input[0], input[1], ...input[2]] :
  [input[0]];
}
function TemplateLiteralTypesMapping(input) {
  return input[1];
}
function TemplateLiteralMapping(input) {
  return T.TemplateLiteralDeferred(input);
}
function LiteralBigIntMapping(input) {
  return T.Literal(BigInt(input));
}
function LiteralBooleanMapping(input) {
  return T.Literal(_index2.Guard.IsEqual(input, 'true'));
}
function LiteralNumberMapping(input) {
  return T.Literal(parseFloat(input));
}
function LiteralStringMapping(input) {
  return T.Literal(input);
}
function LiteralMapping(input) {
  return input;
}
function KeyOfMapping(input) {
  return input.length > 0;
}
function IndexArrayMapping(input) {
  return input.reduce((result, current) => {
    return _index2.Guard.IsEqual(current.length, 3) ?
    [...result, [current[1]]] :
    [...result, []];
  }, []);
}
function ExtendsMapping(input) {
  return _index2.Guard.IsEqual(input.length, 6) ?
  [input[1], input[3], input[5]] :
  [];
}
function BaseMapping(input) {
  return _index2.Guard.IsArray(input) && _index2.Guard.IsEqual(input.length, 3) ?
  input[1] :
  input;
}
// deno-coverage-ignore-start
// ...
const FactorIndexArray = (Type, indexArray) => {
  return indexArray.reduce((result, left) => {
    const _left = left;
    return _index2.Guard.IsEqual(_left.length, 1) ? C.IndexDeferred(result, _left[0]) :
    _index2.Guard.IsEqual(_left.length, 0) ? T.Array(result) :
    Unreachable();
  }, Type);
};
// deno-coverage-ignore-stop
const FactorExtends = (type, extend) => {
  return _index2.Guard.IsEqual(extend.length, 3) ?
  C.ConditionalDeferred(type, extend[0], extend[1], extend[2]) :
  type;
};
function FactorMapping(input) {
  const [keyOf, type, indexArray, extend] = input;
  return keyOf ?
  FactorExtends(C.KeyOfDeferred(FactorIndexArray(type, indexArray)), extend) :
  FactorExtends(FactorIndexArray(type, indexArray), extend);
}
// deno-coverage-ignore-start
function ExprBinaryMapping(left, rest) {
  return _index2.Guard.IsEqual(rest.length, 3) ? (() => {
    const [operator, right, next] = rest;
    const Schema = ExprBinaryMapping(right, next);
    if (_index2.Guard.IsEqual(operator, '&')) {
      return T.IsIntersect(Schema) ?
      T.Intersect([left, ...Schema.allOf]) :
      T.Intersect([left, Schema]);
    }
    if (_index2.Guard.IsEqual(operator, '|')) {
      return T.IsUnion(Schema) ?
      T.Union([left, ...Schema.anyOf]) :
      T.Union([left, Schema]);
    }
    Unreachable();
  })() : left;
}
function ExprTermTailMapping(input) {
  return input;
}
function ExprTermMapping(input) {
  const [left, rest] = input;
  return ExprBinaryMapping(left, rest);
}
function ExprTailMapping(input) {
  return input;
}
function ExprMapping(input) {
  const [left, rest] = input;
  return ExprBinaryMapping(left, rest);
}
function ExprReadonlyMapping(input) {
  return T.ImmutableAdd(input[1]);
}
function ExprPipeMapping(input) {
  return input[1];
}
function GenericTypeMapping(input) {
  return T.Generic(input[0], input[2]);
}
// deno-coverage-ignore-start
function InferTypeMapping(input) {
  return _index2.Guard.IsEqual(input.length, 4) ? T.Infer(input[1], input[3]) :
  _index2.Guard.IsEqual(input.length, 2) ? T.Infer(input[1], T.Unknown()) :
  Unreachable();
}
function TypeMapping(input) {
  return input;
}
function PropertyKeyNumberMapping(input) {
  return `${input}`;
}
function PropertyKeyIdentMapping(input) {
  return input;
}
function PropertyKeyQuotedMapping(input) {
  return input;
}
// deno-coverage-ignore-start
function PropertyKeyIndexMapping(input) {
  return T.IsInteger(input[3]) ? T.IntegerKey :
  T.IsNumber(input[3]) ? T.NumberKey :
  T.IsSymbol(input[3]) ? T.StringKey :
  T.IsString(input[3]) ? T.StringKey :
  Unreachable();
}
function PropertyKeyMapping(input) {
  return input;
}
function ReadonlyMapping(input) {
  return input.length > 0;
}
function OptionalMapping(input) {
  return input.length > 0;
}
function PropertyMapping(input) {
  const [isReadonly, key, isOptional, _colon, type] = input;
  return {
    [key]: isReadonly && isOptional ? T.ReadonlyAdd(T.OptionalAdd(type)) :
    isReadonly && !isOptional ? T.ReadonlyAdd(type) :
    !isReadonly && isOptional ? T.OptionalAdd(type) :
    type
  };
}
function PropertyDelimiterMapping(input) {
  return input;
}
function PropertyListMapping(input) {
  return Delimited(input);
}
function PropertiesReduce(propertyList) {
  return propertyList.reduce((result, left) => {
    const isPatternProperties = _index2.Guard.HasPropertyKey(left, T.IntegerKey) || _index2.Guard.HasPropertyKey(left, T.NumberKey) || _index2.Guard.HasPropertyKey(left, T.StringKey);
    // @ts-ignore 5.0.4 - unable to observe ...left on right arm
    return isPatternProperties ?
    [result[0], _index.Memory.Assign(result[1], left)] :
    [_index.Memory.Assign(result[0], left), result[1]];
  }, [{}, {}]);
}
function PropertiesMapping(input) {
  return PropertiesReduce(input[1]);
}
function _Object_Mapping(input) {
  const [properties, patternProperties] = input;
  const options = _index2.Guard.IsEqual(_index2.Guard.Keys(patternProperties).length, 0) ? {} : { patternProperties };
  return T.Object(properties, options);
}
// deno-coverage-ignore-start
function ElementNamedMapping(input) {
  return _index2.Guard.IsEqual(input.length, 5) ? T.ReadonlyAdd(T.OptionalAdd(input[4])) :
  _index2.Guard.IsEqual(input.length, 3) ? input[2] :
  _index2.Guard.IsEqual(input.length, 4) ? _index2.Guard.IsEqual(input[2], 'readonly') ? T.ReadonlyAdd(input[3]) : T.OptionalAdd(input[3]) :
  Unreachable();
}
function ElementReadonlyOptionalMapping(input) {
  return T.ReadonlyAdd(T.OptionalAdd(input[1]));
}
function ElementReadonlyMapping(input) {
  return T.ReadonlyAdd(input[1]);
}
function ElementOptionalMapping(input) {
  return T.OptionalAdd(input[0]);
}
function ElementBaseMapping(input) {
  return input;
}
// deno-coverage-ignore-start
function ElementMapping(input) {
  return _index2.Guard.IsEqual(input.length, 2) ? T.Rest(input[1]) :
  _index2.Guard.IsEqual(input.length, 1) ? input[0] :
  Unreachable();
}
function ElementListMapping(input) {
  return Delimited(input);
}
function TupleMapping(input) {
  return T.Tuple(input[1]);
}
function ParameterReadonlyOptionalMapping(input) {
  return T.ReadonlyAdd(T.OptionalAdd(input[4]));
}
function ParameterReadonlyMapping(input) {
  return T.ReadonlyAdd(input[3]);
}
function ParameterOptionalMapping(input) {
  return T.OptionalAdd(input[3]);
}
function ParameterTypeMapping(input) {
  return input[2];
}
function ParameterBaseMapping(input) {
  return input;
}
// deno-coverage-ignore-start
function ParameterMapping(input) {
  return _index2.Guard.IsEqual(input.length, 2) ? T.Rest(input[1]) :
  _index2.Guard.IsEqual(input.length, 1) ? input[0] :
  Unreachable();
}
function ParameterListMapping(input) {
  return Delimited(input);
}
function _Function_Mapping(input) {
  return T._Function_(input[1], input[4]);
}
function ConstructorMapping(input) {
  return T.Constructor(input[2], input[5]);
}
function ApplyReadonly(state, type) {
  return _index2.Guard.IsEqual(state, 'remove') ? C.ReadonlyRemoveAction(type) :
  _index2.Guard.IsEqual(state, 'add') ? C.ReadonlyAddAction(type) :
  type;
}
function MappedReadonlyMapping(input) {
  return _index2.Guard.IsEqual(input.length, 2) && _index2.Guard.IsEqual(input[0], '-') ? 'remove' :
  _index2.Guard.IsEqual(input.length, 2) && _index2.Guard.IsEqual(input[0], '+') ? 'add' :
  _index2.Guard.IsEqual(input.length, 1) ? 'add' :
  'none';
}
function ApplyOptional(state, type) {
  return _index2.Guard.IsEqual(state, 'remove') ? C.OptionalRemoveAction(type) :
  _index2.Guard.IsEqual(state, 'add') ? C.OptionalAddAction(type) :
  type;
}
function MappedOptionalMapping(input) {
  return _index2.Guard.IsEqual(input.length, 2) && _index2.Guard.IsEqual(input[0], '-') ? 'remove' :
  _index2.Guard.IsEqual(input.length, 2) && _index2.Guard.IsEqual(input[0], '+') ? 'add' :
  _index2.Guard.IsEqual(input.length, 1) ? 'add' :
  'none';
}
function MappedAsMapping(input) {
  return _index2.Guard.IsEqual(input.length, 2) ? [input[1]] : [];
}
function MappedMapping(input) {
  return _index2.Guard.IsArray(input[6]) && _index2.Guard.IsEqual(input[6].length, 1) ?
  C.MappedDeferred(T.Identifier(input[3]), input[5], input[6][0], ApplyReadonly(input[1], ApplyOptional(input[8], input[10]))) :
  C.MappedDeferred(T.Identifier(input[3]), input[5], T.Ref(input[3]), ApplyReadonly(input[1], ApplyOptional(input[8], input[10])));
}
function ReferenceMapping(input) {
  return T.Ref(input);
}
function OptionsMapping(input) {
  return C.OptionsDeferred(input[2], input[4]);
}
function JsonNumberMapping(input) {
  return parseFloat(input);
}
function JsonBooleanMapping(input) {
  return _index2.Guard.IsEqual(input, 'true');
}
function JsonStringMapping(input) {
  return input;
}
function JsonNullMapping(input) {
  return null;
}
function JsonPropertyMapping(input) {
  return { [input[0]]: input[2] };
}
function JsonPropertyListMapping(input) {
  return Delimited(input);
}
function JsonObjectMappingReduce(propertyList) {
  return propertyList.reduce((result, left) => {
    return _index.Memory.Assign(result, left);
  }, {});
}
function JsonObjectMapping(input) {
  return JsonObjectMappingReduce(input[1]);
}
function JsonElementListMapping(input) {
  return Delimited(input);
}
function JsonArrayMapping(input) {
  return input[1];
}
function JsonMapping(input) {
  return input;
}
function PatternBigIntMapping(input) {
  return T.BigInt();
}
function PatternStringMapping(input) {
  return T.String();
}
function PatternNumberMapping(input) {
  return T.Number();
}
function PatternIntegerMapping(input) {
  return T.Integer();
}
function PatternNeverMapping(input) {
  return T.Never();
}
function PatternTextMapping(input) {
  return T.Literal(input);
}
function PatternBaseMapping(input) {
  return input;
}
function PatternGroupMapping(input) {
  return T.Union(input[1]);
}
function PatternUnionMapping(input) {
  return input.length === 3 ? [...input[0], ...input[2]] :
  input.length === 1 ? [...input[0]] :
  [];
}
function PatternTermMapping(input) {
  return [input[0], ...input[1]];
}
function PatternBodyMapping(input) {
  return input;
}
function PatternMapping(input) {
  return input[1];
}
function InterfaceDeclarationHeritageListMapping(input) {
  return Delimited(input);
}
function InterfaceDeclarationHeritageMapping(input) {
  return _index2.Guard.IsEqual(input.length, 2) ? input[1] : [];
}
function InterfaceDeclarationGenericMapping(input) {
  const parameters = input[2];
  const heritage = input[3];
  const [properties, patternProperties] = input[4];
  const options = _index2.Guard.IsEqual(_index2.Guard.Keys(patternProperties).length, 0) ? {} : { patternProperties };
  return { [input[1]]: T.Generic(parameters, C.InterfaceDeferred(heritage, properties, options)) };
}
function InterfaceDeclarationMapping(input) {
  const heritage = input[2];
  const [properties, patternProperties] = input[3];
  const options = _index2.Guard.IsEqual(_index2.Guard.Keys(patternProperties).length, 0) ? {} : { patternProperties };
  return { [input[1]]: C.InterfaceDeferred(heritage, properties, options) };
}
function TypeAliasDeclarationGenericMapping(input) {
  return { [input[1]]: T.Generic(input[2], input[4]) };
}
function TypeAliasDeclarationMapping(input) {
  return { [input[1]]: input[3] };
}
function ExportKeywordMapping(input) {
  return null; // ignored-dont-care
}
function ModuleDeclarationDelimiterMapping(input) {
  return input;
}
function ModuleDeclarationListMapping(input) {
  return PropertiesReduce(Delimited(input));
}
function ModuleDeclarationMapping(input) {
  return input[1];
}
function ModuleMapping(input) {
  const moduleDeclaration = input[0];
  const moduleDeclarationList = input[1];
  return C.ModuleDeferred(_index.Memory.Assign(moduleDeclaration, moduleDeclarationList[0]));
}
function ScriptMapping(input) {
  return input;
} /* v9-5a3ded9be7d4ca1c */
