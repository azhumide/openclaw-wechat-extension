// 零依赖 TS 解析钩子：把 ESM 风格的 "./x.js" 说明符解析到实际存在的 "./x.ts"。
//
// 为什么需要它：插件源码按 esbuild/jiti 的习惯用 "./text.js" 引用 TS 模块，
// 而 Node 内置的 type stripping 不会做这个重映射。生产代码未改动，
// 仅在测试进程内挂载此钩子。
//
// 不设置 format，让 Node 依扩展名自行选择 typescript-strip 转换。
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, nextResolve) {
    try {
        return await nextResolve(specifier, context);
    } catch (err) {
        if (
            (specifier.startsWith("./") || specifier.startsWith("../")) &&
            specifier.endsWith(".js")
        ) {
            const base = new URL(specifier, context.parentURL);
            const tsUrl = new URL(base.href.replace(/\.js$/, ".ts"));
            if (existsSync(fileURLToPath(tsUrl))) {
                return { url: tsUrl.href, shortCircuit: true };
            }
        }
        throw err;
    }
}
