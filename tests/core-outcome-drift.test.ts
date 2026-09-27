// T13：核心判定函数的漂移守卫。
//
// 我们的端到端测试依赖一份内联的核心判定函数快照（tests/helpers/core-outcome.ts）。
// 快照本身是必要的（插件仓库独立、本机无 node_modules），但它有个风险：
// **上游改了、快照没改 → 测试会替旧行为背书，给出假绿**。
//
// 这道守卫用最直接的办法消除风险：核心源码在磁盘上时，逐字比对函数体。
// 上游一改，这里立刻失败，逼我们重新确认契约。
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { CORE_OUTCOME_SOURCE_PATH } from "./helpers/core-outcome.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** 从源码里截出函数体（按大括号配平），返回去掉空白的规范化文本。 */
function extractFunctionBody(source: string, name: string): string | null {
    const start = source.search(new RegExp(`function\\s+${name}\\s*\\(`));
    if (start < 0) return null;
    const braceStart = source.indexOf("{", source.indexOf(")", start));
    if (braceStart < 0) return null;
    let depth = 0;
    for (let i = braceStart; i < source.length; i += 1) {
        if (source[i] === "{") depth += 1;
        else if (source[i] === "}") {
            depth -= 1;
            if (depth === 0) {
                return source.slice(braceStart, i + 1).replace(/\s+/g, "");
            }
        }
    }
    return null;
}

const FUNCTIONS = ["isReplyDispatchDeliveryPending", "resolveReplyDispatchDeliveryOutcome"];

describe("T13 核心判定函数快照不得漂移", () => {
    const coreExists = existsSync(CORE_OUTCOME_SOURCE_PATH);

    for (const fn of FUNCTIONS) {
        test(`${fn}：快照与核心源码一致（核心源码不在时跳过）`, () => {
            if (!coreExists) {
                // 生产/CI 上没有核心源码树，守卫无从比对 —— 明确跳过而非假装通过。
                return;
            }
            const coreSource = readFileSync(CORE_OUTCOME_SOURCE_PATH, "utf8");
            const snapshotSource = readFileSync(
                path.join(HERE, "helpers", "core-outcome.ts"),
                "utf8",
            );

            const coreBody = extractFunctionBody(coreSource, fn);
            const snapshotBody = extractFunctionBody(snapshotSource, fn);

            assert.ok(coreBody, `核心源码里没找到 ${fn} —— 上游可能重命名了，请人工确认契约`);
            assert.ok(snapshotBody, `快照里没找到 ${fn}`);

            assert.equal(
                snapshotBody,
                coreBody,
                `${fn} 的实现与核心源码不一致。\n` +
                    `核心（${CORE_OUTCOME_SOURCE_PATH}）已改动 —— 必须重新确认投递契约，` +
                    `再同步 tests/helpers/core-outcome.ts，否则端到端测试会替旧行为背书。`,
            );
        });
    }
});
