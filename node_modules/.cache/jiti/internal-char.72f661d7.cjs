"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Zero = exports.WhiteSpace = exports.UnderScore = exports.TabSpace = exports.NonZero = exports.NewLine = exports.Hyphen = exports.Dot = exports.DollarSign = exports.Digit = exports.Alpha = void 0; // deno-coverage-ignore-start - parsebox tested
// deno-fmt-ignore-file
// ------------------------------------------------------------------
// Range
// ------------------------------------------------------------------
function Range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, i) => String.fromCharCode(start + i));
}
const Alpha = exports.Alpha = [
...Range(97, 122), // Lowercase
...Range(65, 90) // Uppercase
];
const Zero = exports.Zero = '0';
const NonZero = exports.NonZero = Range(49, 57); // 1 - 9
const Digit = exports.Digit = [Zero, ...NonZero];
// ------------------------------------------------------------------
// Characters
// ------------------------------------------------------------------
const WhiteSpace = exports.WhiteSpace = ' ';
const NewLine = exports.NewLine = '\n';
const TabSpace = exports.TabSpace = '\t';
const UnderScore = exports.UnderScore = '_';
const Dot = exports.Dot = '.';
const DollarSign = exports.DollarSign = '$';
const Hyphen = exports.Hyphen = '-';
// deno-coverage-ignore-stop /* v9-3d23c0d38b48e33a */
