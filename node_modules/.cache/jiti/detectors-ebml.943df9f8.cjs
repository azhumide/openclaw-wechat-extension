"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.detectEbml = detectEbml;var Token = _interopRequireWildcard(require("token-types"));
var _uint8arrayExtras = require("uint8array-extras");
var _parser = require("../parser.js");function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);}








const maximumEbmlDocumentTypeSizeInBytes = 64;
const maximumEbmlElementPayloadSizeInBytes = 1024 * 1024;
const maximumEbmlElementCount = 256;

async function detectEbml(tokenizer) {
  async function readField() {
    const msb = await tokenizer.peekNumber(Token.UINT8);
    let mask = 0x80;
    let ic = 0; // 0 = A, 1 = B, 2 = C, 3 = D

    while ((msb & mask) === 0 && mask !== 0) {
      ++ic;
      mask >>= 1;
    }

    const id = new Uint8Array(ic + 1);
    await (0, _parser.safeReadBuffer)(tokenizer, id, undefined, {
      maximumLength: id.length,
      reason: 'EBML field'
    });
    return id;
  }

  async function readElement() {
    const idField = await readField();
    const lengthField = await readField();

    lengthField[0] ^= 0x80 >> lengthField.length - 1;
    const nrLength = Math.min(6, lengthField.length); // JavaScript can max read 6 bytes integer

    const idView = new DataView(idField.buffer);
    const lengthView = new DataView(lengthField.buffer, lengthField.length - nrLength, nrLength);

    return {
      id: (0, _uint8arrayExtras.getUintBE)(idView),
      len: (0, _uint8arrayExtras.getUintBE)(lengthView)
    };
  }

  async function readChildren(children) {
    let ebmlElementCount = 0;
    while (children > 0) {
      ebmlElementCount++;
      if (ebmlElementCount > maximumEbmlElementCount) {
        return;
      }

      if ((0, _parser.hasExceededUnknownSizeScanBudget)(tokenizer, ebmlScanStart, _parser.maximumUntrustedSkipSizeInBytes)) {
        return;
      }

      const previousPosition = tokenizer.position;
      const element = await readElement();

      if (element.id === 0x42_82) {
        // `DocType` is a short string ("webm", "matroska", ...), reject implausible lengths to avoid large allocations.
        if (element.len > maximumEbmlDocumentTypeSizeInBytes) {
          return;
        }

        const documentTypeLength = (0, _parser.getSafeBound)(element.len, maximumEbmlDocumentTypeSizeInBytes, 'EBML DocType');
        const rawValue = await tokenizer.readToken(new Token.StringType(documentTypeLength));
        return rawValue.replaceAll(/\0.*$/gv, ''); // Return DocType
      }

      if (
      (0, _parser.hasUnknownFileSize)(tokenizer) && (

      !Number.isFinite(element.len) ||
      element.len < 0 ||
      element.len > maximumEbmlElementPayloadSizeInBytes))

      {
        return;
      }

      await (0, _parser.safeIgnore)(tokenizer, element.len, {
        maximumLength: (0, _parser.hasUnknownFileSize)(tokenizer) ? maximumEbmlElementPayloadSizeInBytes : tokenizer.fileInfo.size,
        reason: 'EBML payload'
      }); // ignore payload
      --children;

      // Safeguard against malformed files: bail if the position did not advance.
      if (tokenizer.position <= previousPosition) {
        return;
      }
    }
  }

  const rootElement = await readElement();
  const ebmlScanStart = tokenizer.position;
  const documentType = await readChildren(rootElement.len);

  switch (documentType) {
    case 'webm':
      return {
        ext: 'webm',
        mime: 'video/webm'
      };

    case 'matroska':
      return {
        ext: 'mkv',
        mime: 'video/matroska'
      };

    default:
  }
} /* v9-8a482d126a437c63 */
