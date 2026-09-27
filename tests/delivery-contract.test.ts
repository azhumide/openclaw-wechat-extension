// T5 结构不变量：投递回调必须诚实告知核心「投递结果」。
//
// 背景（见 2026-09-27_133000 附录）：
// 核心把投递回调返回的 undefined 记为「已投递」
// (lifecycle.ts 的 settlePendingFinalDelivery(..., "delivered")）。
// 而插件原本有 8 个裸 return + 1 个隐式 undefined 成功返回，
// 让核心以为消息已发出（实际是有意不发、或延后发送、或确实发出）。
//
// 契约要求（三选一，不允许裸 return）：
//   a) 有意不发    → { visibleReplySent: false, suppression: { reason: "no_visible_result" } }
//   b) 延后/未确认 → { visibleReplySent: false, suppression: { reason: "adapter_returned_no_identity" } }
//   c) 真实发出    → { visibleReplySent: true, content: <text> }
//
// 核心对这些值的处理（src/channels/turn/lifecycle.ts）：
//   undefined                            → settlePendingFinalDelivery(..., "delivered")  ← 谎言
//   visibleReplySent: false              → settlePendingFinalDelivery(..., "suppressed")
//   reason=adapter_returned_no_identity  → 记为 "unknown"（pending，不算已投递）
//   visibleReplySent: true               → 记为 "delivered"
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const DELIVERY_SRC = join(here, "..", "src", "reply-delivery.ts");

// deliverWechatReply 在 dispatchWechatReplyForInbound 内部。
const DELIVERY_FN_START = 1;
const DELIVERY_FN_END = 100_000;

function deliverySource() {
    return readFileSync(DELIVERY_SRC, "utf8");
}

/** 取 deliverWechatReply 的函数体（从其声明处开始做括号配平提取） */
function deliveryFnBody() {
    const src = deliverySource();
    const start = src.indexOf("const deliverWechatReply = async");
    if (start < 0) {
        throw new Error("未找到 deliverWechatReply 声明；投递入口已重命名，请更新本测试");
    }
    const braceStart = src.indexOf("{", src.indexOf("=>", start));
    let depth = 0;
    let inStr = null;
    for (let i = braceStart; i < src.length; i += 1) {
        const c = src[i];
        if (inStr) {
            if (c === "\\") i += 1;
            else if (c === inStr) inStr = null;
            continue;
        }
        if (c === '"' || c === "'" || c === "`") {
            inStr = c;
            continue;
        }
        if (c === "{") depth += 1;
        else if (c === "}") {
            depth -= 1;
            if (depth === 0) return src.slice(braceStart, i + 1);
        }
    }
    throw new Error("deliverWechatReply 函数体未闭合");
}

function bareReturns() {
    const hits = [];
    const lines = deliveryFnBody().split("\n");
    for (let i = 0; i < lines.length; i += 1) {
        if (/^\s*return;\s*$/.test(lines[i])) {
            hits.push(i + 1);
        }
    }
    return hits;
}

function countMatches(haystack, re) {
    return (haystack.match(re) ?? []).length;
}

describe("T5 投递回调的诚实返回值契约", () => {
    test("投递入口不得有裸 return（每一个都会让核心误记为已投递）", () => {
        const hits = bareReturns();
        assert.deepEqual(
            hits,
            [],
            [
                `投递入口仍有 ${hits.length} 处裸 return：${hits.map((n) => `fn 内第 ${n} 行`).join(", ")}。`,
                "裸 return 返回 undefined，核心会把它记成「已投递」——即使实际没发。",
                "应改为：有意不发 → suppression:{reason:\"no_visible_result\"}；",
                "延后/未确认 → suppression:{reason:\"adapter_returned_no_identity\"}；",
                "真实发出 → { visibleReplySent: true, content }。",
            ].join("\n"),
        );
    });

    test("有意不发的分支使用 no_visible_result", () => {
        const body = deliveryFnBody();
        // 语义集中在 suppressWechatDelivery() 辅助函数中，出口只调用它。
        assert.match(
            deliverySource(),
            /const suppressWechatDelivery = \(\)[\s\S]{0,120}?reason:\s*"no_visible_result"/,
            "suppressWechatDelivery() 必须以 no_visible_result 声明「有意不发」",
        );
        const callSites = countMatches(body, /return suppressWechatDelivery\(\);/g);
        assert.ok(
            callSites >= 5,
            `预期至少 5 处出口走「有意不发」（错误抑制/文本跳过/增量跳过/工具失败/授权拦截/无新内容），实际 ${callSites}`,
        );
    });

    test("延后发送的分支使用 adapter_returned_no_identity（而非谎称已发）", () => {
        const body = deliveryFnBody();
        assert.match(
            deliverySource(),
            /const deferWechatDelivery = \(\)[\s\S]{0,140}?reason:\s*"adapter_returned_no_identity"/,
            "deferWechatDelivery() 必须以 adapter_returned_no_identity 声明「延后/未确认」",
        );
        // 【方案 A 之后】final 路径已改为就地投递，不再延后 → 只剩媒体-only 缓冲一处。
        // 保留 >=1 的下限：媒体路径若被删除，这条断言会失败，提示重新审计延后语义。
        const callSites = countMatches(body, /return deferWechatDelivery\(\);/g);
        assert.ok(
            callSites >= 1,
            `预期至少 1 处延后出口（媒体-only 缓冲），实际 ${callSites}；` +
                `final 路径已于方案 A 改为就地投递，不应再出现在此`,
        );
    });

    test("真实发出后返回 visibleReplySent: true 并带上内容", () => {
        const body = deliveryFnBody();
        assert.match(
            body,
            /visibleReplySent:\s*true/,
            "成功路径必须返回 { visibleReplySent: true, ... }，否则核心无法确认已投递",
        );
        assert.match(
            body,
            /content:\s*textToProcess/,
            "成功路径应回传已发送文本（content），供核心记账与观察者使用",
        );
    });

    // 注：原先此处有一条守卫断言「仍走 provider funnel（迁移时须同步更新本测试）」。
    // 迁移已完成 → 该断言已由 tests/contract-migration.test.ts 的 T6 取代
    // （断言 delivery 声明用 `deliver` 键、且不再出现 deliverWithProviderMessageSending）。
});
