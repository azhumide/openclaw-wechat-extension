"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Codec = Codec;exports.Decode = Decode;exports.DecodeBuilder = void 0;exports.Encode = Encode;exports.EncodeBuilder = void 0;exports.IsCodec = IsCodec;

var _index = require("../../system/index.mjs");
var _index2 = require("../../guard/index.mjs");
var _schema = require("./schema.mjs"); // deno-lint-ignore-file ban-types
// deno-fmt-ignore-file
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
class EncodeBuilder {constructor(type, decode) {
    this.type = type;
    this.decode = decode;
  }
  Encode(callback) {
    const type = this.type;
    const decode = IsCodec(type) ? (value) => this.decode(type['~codec'].decode(value)) : this.decode;
    const encode = IsCodec(type) ? (value) => type['~codec'].encode(callback(value)) : callback;
    const codec = { decode, encode };
    return _index.Memory.Update(this.type, { '~codec': codec }, {});
  }
}exports.EncodeBuilder = EncodeBuilder;
class DecodeBuilder {
  constructor(type) {
    this.type = type;
  }
  Decode(callback) {
    return new EncodeBuilder(this.type, callback);
  }
}
// ------------------------------------------------------------------
// Bidirectional
// ------------------------------------------------------------------
/** Creates a bi-directional Codec. Codec functions are called on Value.Decode and Value.Encode. */exports.DecodeBuilder = DecodeBuilder;
function Codec(type) {
  return new DecodeBuilder(type);
}
// ------------------------------------------------------------------
// Unidirectional
// ------------------------------------------------------------------
/** Createsa  uni-directional Codec with Decode only. The Decode function is called on Value.Decode */
function Decode(type, callback) {
  return Codec(type).Decode(callback).Encode(() => {
    throw Error('Encode not implemented');
  });
}
/** Creates a uni-directional Codec with Encode only. The Encode function is called on Value.Encode */
function Encode(type, callback) {
  return Codec(type).Decode(() => {
    throw Error('Decode not implemented');
  }).Encode(callback);
}
// ------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------
function IsCodec(value) {
  return (0, _schema.IsSchema)(value) &&
  _index2.Guard.HasPropertyKey(value, '~codec') &&
  _index2.Guard.IsObject(value['~codec']) &&
  _index2.Guard.HasPropertyKey(value['~codec'], 'encode') &&
  _index2.Guard.HasPropertyKey(value['~codec'], 'decode');
} /* v9-27a8fa2e9fd33158 */
