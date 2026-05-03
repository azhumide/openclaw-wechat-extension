"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ExtendsIntersect = ExtendsIntersect;
var _extends_left = require("./extends_left.mjs");








var _index = require("../engine/evaluate/index.mjs"); // deno-fmt-ignore-file
// ----------------------------------------------------------------------------
// ExtendsIntersect
//
// This function evaluates the intersection and continues. This is different
// to IntersectRight which MUST enumerate each type to derive Inferred. Left 
// side types do not infer so it should be ok to do this.
//
// ----------------------------------------------------------------------------
function ExtendsIntersect(inferred, left, right) {const evaluated = (0, _index.EvaluateIntersect)(left);return (0, _extends_left.ExtendsLeft)(inferred, evaluated, right);} /* v9-f7e46cab4ff877b3 */
