"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.And = And;exports.ArrayLiteral = ArrayLiteral;exports.ArrowFunction = ArrowFunction;exports.Call = Call;exports.ConstDeclaration = ConstDeclaration;exports.Constant = Constant;exports.Entries = Entries;exports.Every = Every;exports.HasPropertyKey = HasPropertyKey;exports.If = If;exports.IsArray = IsArray;exports.IsAsyncIterator = IsAsyncIterator;exports.IsBigInt = IsBigInt;exports.IsBoolean = IsBoolean;exports.IsConstructor = IsConstructor;exports.IsDeepEqual = IsDeepEqual;exports.IsEqual = IsEqual;exports.IsFunction = IsFunction;exports.IsGreaterEqualThan = IsGreaterEqualThan;exports.IsGreaterThan = IsGreaterThan;exports.IsInteger = IsInteger;exports.IsIterator = IsIterator;exports.IsLessEqualThan = IsLessEqualThan;exports.IsLessThan = IsLessThan;exports.IsMaxLength = IsMaxLength;exports.IsMinLength = IsMinLength;exports.IsNull = IsNull;exports.IsNumber = IsNumber;exports.IsObject = IsObject;exports.IsObjectNotArray = IsObjectNotArray;exports.IsString = IsString;exports.IsSymbol = IsSymbol;exports.IsUndefined = IsUndefined;exports.Keys = Keys;exports.Member = Member;exports.MultipleOf = MultipleOf;exports.New = New;exports.Not = Not;exports.Or = Or;exports.PrefixIncrement = PrefixIncrement;exports.ReduceAnd = ReduceAnd;exports.ReduceOr = ReduceOr;exports.Return = Return;exports.Statements = Statements;exports.Ternary = Ternary;var G = _interopRequireWildcard(require("./guard.mjs"));function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);}
// ------------------------------------------------------------------
// Identifier
// ------------------------------------------------------------------
const identifierRegExp = /^[\p{ID_Start}_$][\p{ID_Continue}_$\u200C\u200D]*$/u;
/** Returns true if this value is a valid JavaScript identifier */
function IsIdentifier(value) {
  return identifierRegExp.test(value);
}
// ------------------------------------------------------------------
// Logical
// ------------------------------------------------------------------
function And(left, right) {
  return `(${left} && ${right})`;
}
function Or(left, right) {
  return `(${left} || ${right})`;
}
function Not(expr) {
  return `!(${expr})`;
}
// --------------------------------------------------------------------------
// Guards
// --------------------------------------------------------------------------
/** Returns true if this value is an array */
function IsArray(value) {
  return `Array.isArray(${value})`;
}
/** Returns true if this value is an async iterator */
function IsAsyncIterator(value) {
  return `Guard.IsAsyncIterator(${value})`;
}
/** Returns true if this value is bigint */
function IsBigInt(value) {
  return `typeof ${value} === "bigint"`;
}
/** Returns true if this value is a boolean */
function IsBoolean(value) {
  return `typeof ${value} === "boolean"`;
}
/** Returns true if this value is integer */
function IsInteger(value) {
  return `Number.isInteger(${value})`;
}
/** Returns true if this value is an iterator */
function IsIterator(value) {
  return `Guard.IsIterator(${value})`;
}
/** Returns true if this value is null */
function IsNull(value) {
  return `${value} === null`;
}
/** Returns true if this value is number */
function IsNumber(value) {
  return `Number.isFinite(${value})`;
}
/** Returns true if this value is an object but not an array */
function IsObjectNotArray(value) {
  return And(IsObject(value), Not(IsArray(value)));
}
/** Returns true if this value is an object */
function IsObject(value) {
  return `typeof ${value} === "object" && ${value} !== null`;
}
/** Returns true if this value is string */
function IsString(value) {
  return `typeof ${value} === "string"`;
}
/** Returns true if this value is symbol */
function IsSymbol(value) {
  return `typeof ${value} === "symbol"`;
}
/** Returns true if this value is undefined */
function IsUndefined(value) {
  return `${value} === undefined`;
}
// ------------------------------------------------------------------
// Functions and Constructors
// ------------------------------------------------------------------
function IsFunction(value) {
  return `typeof ${value} === "function"`;
}
function IsConstructor(value) {
  return `Guard.IsConstructor(${value})`;
}
// ------------------------------------------------------------------
// Relational
// ------------------------------------------------------------------
function IsEqual(left, right) {
  return `${left} === ${right}`;
}
function IsGreaterThan(left, right) {
  return `${left} > ${right}`;
}
function IsLessThan(left, right) {
  return `${left} < ${right}`;
}
function IsLessEqualThan(left, right) {
  return `${left} <= ${right}`;
}
function IsGreaterEqualThan(left, right) {
  return `${left} >= ${right}`;
}
// --------------------------------------------------------------------------
// String
// --------------------------------------------------------------------------
function IsMinLength(value, length) {
  return `Guard.IsMinLength(${value}, ${length})`;
}
function IsMaxLength(value, length) {
  return `Guard.IsMaxLength(${value}, ${length})`;
}
// --------------------------------------------------------------------------
// Array
// --------------------------------------------------------------------------
function Every(value, offset, params, expression) {
  return G.IsEqual(offset, '0') ?
  `${value}.every((${params[0]}, ${params[1]}) => ${expression})` :
  `((value, callback) => { for(let index = ${offset}; index < value.length; index++) if (!callback(value[index], index)) return false; return true })(${value}, (${params[0]}, ${params[1]}) => ${expression})`;
}
// --------------------------------------------------------------------------
// Objects
// --------------------------------------------------------------------------
function Entries(value) {
  return `Object.entries(${value})`;
}
function Keys(value) {
  return `Object.getOwnPropertyNames(${value})`;
}
function HasPropertyKey(value, key) {
  const isProtoField = G.IsEqual(key, '"__proto__"') || G.IsEqual(key, '"constructor"');
  return isProtoField ? `Object.prototype.hasOwnProperty.call(${value}, ${key})` : `${key} in ${value}`;
}
function IsDeepEqual(left, right) {
  return `Guard.IsDeepEqual(${left}, ${right})`;
}
// ------------------------------------------------------------------
// Expressions
// ------------------------------------------------------------------
function ArrayLiteral(elements) {
  return `[${elements.join(', ')}]`;
}
function ArrowFunction(parameters, body) {
  return `((${parameters.join(', ')}) => ${body})`;
}
function Call(value, arguments_) {
  return `${value}(${arguments_.join(', ')})`;
}
function New(value, arguments_) {
  return `new ${value}(${arguments_.join(', ')})`;
}
function Member(left, right) {
  return `${left}${IsIdentifier(right) ? `.${right}` : `[${Constant(right)}]`}`;
}
function Constant(value) {
  return G.IsString(value) ? JSON.stringify(value) : `${value}`;
}
function Ternary(condition, true_, false_) {
  return `(${condition} ? ${true_} : ${false_})`;
}
// ------------------------------------------------------------------
// Statements
// ------------------------------------------------------------------
function Statements(statements) {
  return `{ ${statements.join('; ')}; }`;
}
function ConstDeclaration(identifier, expression) {
  return `const ${identifier} = ${expression}`;
}
function If(condition, then) {
  return `if(${condition}) { ${then} }`;
}
function Return(expression) {
  return `return ${expression}`;
}
// ------------------------------------------------------------------
// Logical
// ------------------------------------------------------------------
function ReduceAnd(operands) {
  return G.IsEqual(operands.length, 0) ? 'true' : operands.reduce((left, right) => And(left, right));
}
function ReduceOr(operands) {
  // deno-coverage-ignore - we never observe 0 operands
  return G.IsEqual(operands.length, 0) ? 'false' : operands.reduce((left, right) => Or(left, right));
}
// --------------------------------------------------------------------------
// Arithmetic
// --------------------------------------------------------------------------
function PrefixIncrement(expression) {
  return `++${expression}`;
}
function MultipleOf(dividend, divisor) {
  return `Guard.IsMultipleOf(${dividend}, ${divisor})`;
} /* v9-e832931160364154 */
