"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.detectAsf = detectAsf;var Token = _interopRequireWildcard(require("token-types"));
var strtok3 = _interopRequireWildcard(require("strtok3/core"));
var _parser = require("../parser.js");function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);}









const maximumAsfHeaderObjectCount = 512;
const maximumAsfHeaderPayloadSizeInBytes = 1024 * 1024;

async function detectAsf(tokenizer) {
  let isMalformedAsf = false;
  try {
    async function readHeader() {
      const guid = new Uint8Array(16);
      await (0, _parser.safeReadBuffer)(tokenizer, guid, undefined, {
        maximumLength: guid.length,
        reason: 'ASF header GUID'
      });
      return {
        id: guid,
        size: Number(await tokenizer.readToken(Token.UINT64_LE))
      };
    }

    await (0, _parser.safeIgnore)(tokenizer, 30, {
      maximumLength: 30,
      reason: 'ASF header prelude'
    });
    const isUnknownFileSize = (0, _parser.hasUnknownFileSize)(tokenizer);
    const asfHeaderScanStart = tokenizer.position;
    let asfHeaderObjectCount = 0;
    while (tokenizer.position + 24 < tokenizer.fileInfo.size) {
      asfHeaderObjectCount++;
      if (asfHeaderObjectCount > maximumAsfHeaderObjectCount) {
        break;
      }

      if ((0, _parser.hasExceededUnknownSizeScanBudget)(tokenizer, asfHeaderScanStart, _parser.maximumUntrustedSkipSizeInBytes)) {
        break;
      }

      const previousPosition = tokenizer.position;
      const header = await readHeader();
      let payload = header.size - 24;
      if (
      !Number.isFinite(payload) ||
      payload < 0)
      {
        isMalformedAsf = true;
        break;
      }

      if ((0, _parser.checkBytes)(header.id, [0x91, 0x07, 0xDC, 0xB7, 0xB7, 0xA9, 0xCF, 0x11, 0x8E, 0xE6, 0x00, 0xC0, 0x0C, 0x20, 0x53, 0x65])) {
        // Sync on Stream-Properties-Object (B7DC0791-A9B7-11CF-8EE6-00C00C205365)
        const typeId = new Uint8Array(16);
        payload -= await (0, _parser.safeReadBuffer)(tokenizer, typeId, undefined, {
          maximumLength: typeId.length,
          reason: 'ASF stream type GUID'
        });

        if ((0, _parser.checkBytes)(typeId, [0x40, 0x9E, 0x69, 0xF8, 0x4D, 0x5B, 0xCF, 0x11, 0xA8, 0xFD, 0x00, 0x80, 0x5F, 0x5C, 0x44, 0x2B])) {
          // Found audio:
          return {
            ext: 'asf',
            mime: 'audio/x-ms-asf'
          };
        }

        if ((0, _parser.checkBytes)(typeId, [0xC0, 0xEF, 0x19, 0xBC, 0x4D, 0x5B, 0xCF, 0x11, 0xA8, 0xFD, 0x00, 0x80, 0x5F, 0x5C, 0x44, 0x2B])) {
          // Found video:
          return {
            ext: 'asf',
            mime: 'video/x-ms-asf'
          };
        }

        break;
      }

      if (
      isUnknownFileSize &&
      payload > maximumAsfHeaderPayloadSizeInBytes)
      {
        isMalformedAsf = true;
        break;
      }

      await (0, _parser.safeIgnore)(tokenizer, payload, {
        maximumLength: isUnknownFileSize ? maximumAsfHeaderPayloadSizeInBytes : tokenizer.fileInfo.size,
        reason: 'ASF header payload'
      });

      // Safeguard against malformed files: break if the position did not advance.
      if (tokenizer.position <= previousPosition) {
        isMalformedAsf = true;
        break;
      }
    }
  } catch (error) {
    if (
    error instanceof strtok3.EndOfStreamError ||
    error instanceof _parser.ParserHardLimitError)
    {
      if ((0, _parser.hasUnknownFileSize)(tokenizer)) {
        isMalformedAsf = true;
      }
    } else {
      throw error;
    }
  }

  if (isMalformedAsf) {
    return;
  }

  // Default to ASF generic extension
  return {
    ext: 'asf',
    mime: 'application/vnd.ms-asf'
  };
} /* v9-f1e58f7345d75c0c */
