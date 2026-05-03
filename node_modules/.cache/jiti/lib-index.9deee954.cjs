"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.Uint8ArrayType = exports.UINT8 = exports.UINT64_LE = exports.UINT64_BE = exports.UINT32_LE = exports.UINT32_BE = exports.UINT24_LE = exports.UINT24_BE = exports.UINT16_LE = exports.UINT16_BE = exports.StringType = exports.IgnoreType = exports.INT8 = exports.INT64_LE = exports.INT64_BE = exports.INT32_LE = exports.INT32_BE = exports.INT24_LE = exports.INT24_BE = exports.INT16_LE = exports.INT16_BE = exports.Float80_LE = exports.Float80_BE = exports.Float64_LE = exports.Float64_BE = exports.Float32_LE = exports.Float32_BE = exports.Float16_LE = exports.Float16_BE = exports.AnsiStringType = void 0;var ieee754 = _interopRequireWildcard(require("ieee754"));
var _textCodec = require("@borewit/text-codec");function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);}
// Primitive types
function dv(array) {
  return new DataView(array.buffer, array.byteOffset);
}
/*
 * 8-bit unsigned integer
 */
const UINT8 = exports.UINT8 = {
  len: 1,
  get(array, offset) {
    return dv(array).getUint8(offset);
  },
  put(array, offset, value) {
    dv(array).setUint8(offset, value);
    return offset + 1;
  }
};
/**
 * 16-bit unsigned integer, Little Endian byte order
 */
const UINT16_LE = exports.UINT16_LE = {
  len: 2,
  get(array, offset) {
    return dv(array).getUint16(offset, true);
  },
  put(array, offset, value) {
    dv(array).setUint16(offset, value, true);
    return offset + 2;
  }
};
/**
 * 16-bit unsigned integer, Big Endian byte order
 */
const UINT16_BE = exports.UINT16_BE = {
  len: 2,
  get(array, offset) {
    return dv(array).getUint16(offset);
  },
  put(array, offset, value) {
    dv(array).setUint16(offset, value);
    return offset + 2;
  }
};
/**
 * 24-bit unsigned integer, Little Endian byte order
 */
const UINT24_LE = exports.UINT24_LE = {
  len: 3,
  get(array, offset) {
    const dataView = dv(array);
    return dataView.getUint8(offset) + (dataView.getUint16(offset + 1, true) << 8);
  },
  put(array, offset, value) {
    const dataView = dv(array);
    dataView.setUint8(offset, value & 0xff);
    dataView.setUint16(offset + 1, value >> 8, true);
    return offset + 3;
  }
};
/**
 * 24-bit unsigned integer, Big Endian byte order
 */
const UINT24_BE = exports.UINT24_BE = {
  len: 3,
  get(array, offset) {
    const dataView = dv(array);
    return (dataView.getUint16(offset) << 8) + dataView.getUint8(offset + 2);
  },
  put(array, offset, value) {
    const dataView = dv(array);
    dataView.setUint16(offset, value >> 8);
    dataView.setUint8(offset + 2, value & 0xff);
    return offset + 3;
  }
};
/**
 * 32-bit unsigned integer, Little Endian byte order
 */
const UINT32_LE = exports.UINT32_LE = {
  len: 4,
  get(array, offset) {
    return dv(array).getUint32(offset, true);
  },
  put(array, offset, value) {
    dv(array).setUint32(offset, value, true);
    return offset + 4;
  }
};
/**
 * 32-bit unsigned integer, Big Endian byte order
 */
const UINT32_BE = exports.UINT32_BE = {
  len: 4,
  get(array, offset) {
    return dv(array).getUint32(offset);
  },
  put(array, offset, value) {
    dv(array).setUint32(offset, value);
    return offset + 4;
  }
};
/**
 * 8-bit signed integer
 */
const INT8 = exports.INT8 = {
  len: 1,
  get(array, offset) {
    return dv(array).getInt8(offset);
  },
  put(array, offset, value) {
    dv(array).setInt8(offset, value);
    return offset + 1;
  }
};
/**
 * 16-bit signed integer, Big Endian byte order
 */
const INT16_BE = exports.INT16_BE = {
  len: 2,
  get(array, offset) {
    return dv(array).getInt16(offset);
  },
  put(array, offset, value) {
    dv(array).setInt16(offset, value);
    return offset + 2;
  }
};
/**
 * 16-bit signed integer, Little Endian byte order
 */
const INT16_LE = exports.INT16_LE = {
  len: 2,
  get(array, offset) {
    return dv(array).getInt16(offset, true);
  },
  put(array, offset, value) {
    dv(array).setInt16(offset, value, true);
    return offset + 2;
  }
};
/**
 * 24-bit signed integer, Little Endian byte order
 */
const INT24_LE = exports.INT24_LE = {
  len: 3,
  get(array, offset) {
    const unsigned = UINT24_LE.get(array, offset);
    return unsigned > 0x7fffff ? unsigned - 0x1000000 : unsigned;
  },
  put(array, offset, value) {
    const dataView = dv(array);
    dataView.setUint8(offset, value & 0xff);
    dataView.setUint16(offset + 1, value >> 8, true);
    return offset + 3;
  }
};
/**
 * 24-bit signed integer, Big Endian byte order
 */
const INT24_BE = exports.INT24_BE = {
  len: 3,
  get(array, offset) {
    const unsigned = UINT24_BE.get(array, offset);
    return unsigned > 0x7fffff ? unsigned - 0x1000000 : unsigned;
  },
  put(array, offset, value) {
    const dataView = dv(array);
    dataView.setUint16(offset, value >> 8);
    dataView.setUint8(offset + 2, value & 0xff);
    return offset + 3;
  }
};
/**
 * 32-bit signed integer, Big Endian byte order
 */
const INT32_BE = exports.INT32_BE = {
  len: 4,
  get(array, offset) {
    return dv(array).getInt32(offset);
  },
  put(array, offset, value) {
    dv(array).setInt32(offset, value);
    return offset + 4;
  }
};
/**
 * 32-bit signed integer, Big Endian byte order
 */
const INT32_LE = exports.INT32_LE = {
  len: 4,
  get(array, offset) {
    return dv(array).getInt32(offset, true);
  },
  put(array, offset, value) {
    dv(array).setInt32(offset, value, true);
    return offset + 4;
  }
};
/**
 * 64-bit unsigned integer, Little Endian byte order
 */
const UINT64_LE = exports.UINT64_LE = {
  len: 8,
  get(array, offset) {
    return dv(array).getBigUint64(offset, true);
  },
  put(array, offset, value) {
    dv(array).setBigUint64(offset, value, true);
    return offset + 8;
  }
};
/**
 * 64-bit signed integer, Little Endian byte order
 */
const INT64_LE = exports.INT64_LE = {
  len: 8,
  get(array, offset) {
    return dv(array).getBigInt64(offset, true);
  },
  put(array, offset, value) {
    dv(array).setBigInt64(offset, value, true);
    return offset + 8;
  }
};
/**
 * 64-bit unsigned integer, Big Endian byte order
 */
const UINT64_BE = exports.UINT64_BE = {
  len: 8,
  get(array, offset) {
    return dv(array).getBigUint64(offset);
  },
  put(array, offset, value) {
    dv(array).setBigUint64(offset, value);
    return offset + 8;
  }
};
/**
 * 64-bit signed integer, Big Endian byte order
 */
const INT64_BE = exports.INT64_BE = {
  len: 8,
  get(array, offset) {
    return dv(array).getBigInt64(offset);
  },
  put(array, offset, value) {
    dv(array).setBigInt64(offset, value);
    return offset + 8;
  }
};
/**
 * IEEE 754 16-bit (half precision) float, big endian
 */
const Float16_BE = exports.Float16_BE = {
  len: 2,
  get(dataView, offset) {
    return ieee754.read(dataView, offset, false, 10, this.len);
  },
  put(dataView, offset, value) {
    ieee754.write(dataView, value, offset, false, 10, this.len);
    return offset + this.len;
  }
};
/**
 * IEEE 754 16-bit (half precision) float, little endian
 */
const Float16_LE = exports.Float16_LE = {
  len: 2,
  get(array, offset) {
    return ieee754.read(array, offset, true, 10, this.len);
  },
  put(array, offset, value) {
    ieee754.write(array, value, offset, true, 10, this.len);
    return offset + this.len;
  }
};
/**
 * IEEE 754 32-bit (single precision) float, big endian
 */
const Float32_BE = exports.Float32_BE = {
  len: 4,
  get(array, offset) {
    return dv(array).getFloat32(offset);
  },
  put(array, offset, value) {
    dv(array).setFloat32(offset, value);
    return offset + 4;
  }
};
/**
 * IEEE 754 32-bit (single precision) float, little endian
 */
const Float32_LE = exports.Float32_LE = {
  len: 4,
  get(array, offset) {
    return dv(array).getFloat32(offset, true);
  },
  put(array, offset, value) {
    dv(array).setFloat32(offset, value, true);
    return offset + 4;
  }
};
/**
 * IEEE 754 64-bit (double precision) float, big endian
 */
const Float64_BE = exports.Float64_BE = {
  len: 8,
  get(array, offset) {
    return dv(array).getFloat64(offset);
  },
  put(array, offset, value) {
    dv(array).setFloat64(offset, value);
    return offset + 8;
  }
};
/**
 * IEEE 754 64-bit (double precision) float, little endian
 */
const Float64_LE = exports.Float64_LE = {
  len: 8,
  get(array, offset) {
    return dv(array).getFloat64(offset, true);
  },
  put(array, offset, value) {
    dv(array).setFloat64(offset, value, true);
    return offset + 8;
  }
};
/**
 * IEEE 754 80-bit (extended precision) float, big endian
 */
const Float80_BE = exports.Float80_BE = {
  len: 10,
  get(array, offset) {
    return ieee754.read(array, offset, false, 63, this.len);
  },
  put(array, offset, value) {
    ieee754.write(array, value, offset, false, 63, this.len);
    return offset + this.len;
  }
};
/**
 * IEEE 754 80-bit (extended precision) float, little endian
 */
const Float80_LE = exports.Float80_LE = {
  len: 10,
  get(array, offset) {
    return ieee754.read(array, offset, true, 63, this.len);
  },
  put(array, offset, value) {
    ieee754.write(array, value, offset, true, 63, this.len);
    return offset + this.len;
  }
};
/**
 * Ignore a given number of bytes
 */
class IgnoreType {
  /**
   * @param len number of bytes to ignore
   */
  constructor(len) {
    this.len = len;
  }
  // ToDo: don't read, but skip data
  get(_array, _off) {
  }
}exports.IgnoreType = IgnoreType;
class Uint8ArrayType {
  constructor(len) {
    this.len = len;
  }
  get(array, offset) {
    return array.subarray(offset, offset + this.len);
  }
}
/**
 * Consume a fixed number of bytes from the stream and return a string with a specified encoding.
 * Supports all encodings supported by TextDecoder, plus 'windows-1252'.
 */exports.Uint8ArrayType = Uint8ArrayType;
class StringType {
  constructor(len, encoding) {
    this.len = len;
    this.encoding = encoding;
  }
  get(data, offset = 0) {
    const bytes = data.subarray(offset, offset + this.len);
    return (0, _textCodec.textDecode)(bytes, this.encoding);
  }
}
/**
 * ANSI Latin 1 String using Windows-1252 (Code Page 1252)
 * Windows-1252 is a superset of ISO 8859-1 / Latin-1.
 */exports.StringType = StringType;
class AnsiStringType extends StringType {
  constructor(len) {
    super(len, 'windows-1252');
  }
}exports.AnsiStringType = AnsiStringType; /* v9-2fa0f18be14e48c8 */
