"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.DistributeArguments = DistributeArguments;
var _index = require("../../../guard/index.mjs");
var _union = require("../../types/union.mjs");
var _deferred = require("../../types/deferred.mjs");
var _ref = require("../../types/ref.mjs"); // deno-fmt-ignore-file
function CollectDistributionNames(expression, result = []) {
  return (
    // Conditional
    (0, _deferred.IsDeferred)(expression) && _index.Guard.IsEqual(expression.action, 'Conditional') ?
    (0, _ref.IsRef)(expression.parameters[0]) ?
    CollectDistributionNames(expression.parameters[2], CollectDistributionNames(expression.parameters[3], [...result, expression.parameters[0]['$ref']])) :
    CollectDistributionNames(expression.parameters[2], CollectDistributionNames(expression.parameters[3], result))
    // Mapped
    : (0, _deferred.IsDeferred)(expression) && _index.Guard.IsEqual(expression.action, 'Mapped') ?
    (0, _deferred.IsDeferred)(expression.parameters[1]) && _index.Guard.IsEqual(expression.parameters[1].action, 'KeyOf') && (0, _ref.IsRef)(expression.parameters[1].parameters[0]) ? [...result, expression.parameters[1].parameters[0]['$ref']] :
    result : result);
}
function BuildDistributionArray(parameters, names) {
  return parameters.reduce((result, left) => [...result, names.includes(left.name)], []);
}
function ZipDistributionArray(arguments_, distributionArray, result = []) {
  return _index.Guard.TakeLeft(arguments_, (argumentLeft, argumentRight) => _index.Guard.TakeLeft(distributionArray, (booleanLeft, booleanRight) => ZipDistributionArray(argumentRight, booleanRight, [...result, [booleanLeft, argumentLeft]]), () => result), () => result);
}
function Expand(type) {
  return (0, _union.IsUnion)(type) ?
  [...type.anyOf] :
  [type];
}
function Append(current, type) {
  return current.reduce((result, left) => [...result, [...left, type]], []);
}
function Cross(current, variants) {
  return variants.reduce((result, left) => {
    return [...result, ...Append(current, left)];
  }, []);
}
function Distribute(zipped) {
  return zipped.reduce((result, left) => {
    return _index.Guard.IsEqual(left[0], true) ?
    Cross(result, Expand(left[1])) :
    Cross(result, [left[1]]); // - no-expansion
  }, [[]]);
}
function DistributeArguments(parameters, arguments_, expression) {
  const distributionNames = CollectDistributionNames(expression);
  const distributionArray = BuildDistributionArray(parameters, distributionNames);
  const zippedArguments = ZipDistributionArray(arguments_, distributionArray);
  return (0, _deferred.IsDeferred)(expression) && _index.Guard.IsEqual(expression.action, 'Conditional') ?
  Distribute(zippedArguments) :
  (0, _deferred.IsDeferred)(expression) && _index.Guard.IsEqual(expression.action, 'Mapped') ?
  Distribute(zippedArguments) :
  [arguments_];
} /* v9-6fc81222cdbcb566 */
