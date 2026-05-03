"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.n = safeParseWithSchema;exports.t = safeParseJsonWithSchema; //#region src/utils/zod-parse.ts
function safeParseWithSchema(schema, value) {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
function safeParseJsonWithSchema(schema, raw) {
  try {
    return safeParseWithSchema(schema, JSON.parse(raw));
  } catch {
    return null;
  }
}
//#endregion /* v9-cdf35c4f55fdd454 */
