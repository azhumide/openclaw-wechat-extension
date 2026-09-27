// T8：final 投递必须就地完成（方案 A —— flush 前移）
//
// 背景：
//   改造前 `deliverWechatReply` 遇到 `kind=final` 时「存起来 + return」，
//   真实发送推迟到回合末的 `finalBuffer.flush`。核心因此拿不到这次投递的结果，
//   会把它记成「已投递」——这正是审计发现的**事务性契约违规**。
//
//   实测（590 次样本）`bufferedFinals` **恒为 1**、Buffer/Flush **295:295 成对**，
//   说明 finalBuffer 的真实职责是「合并去重后择一发送」，不是「攒着等时机」。
//   因此把 flush 前移进同一调用栈是**等价变换**，且结果对核心可见。
//
// 为什么必须同栈完成（而不是用 `finalization`）：
//   核心在 `dispatchChannelInboundTurn` 返回**之前**就 await `finalization`
//   （lifecycle.ts 的结算在回合内部），而原来的 flush 在返回**之后**才跑
//   → 用 `finalization` 会永久挂死。
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const source = () => readFileSync(join(HERE, "..", "src", "reply-delivery.ts"), "utf8");

/** 括号配平提取 deliverWechatReply 函数体（正则易在嵌套 } 处截断） */
function deliveryFnBody(): string {
    const src = source();
    const start = src.indexOf("const deliverWechatReply = async");
    assert.ok(start >= 0, "未找到 deliverWechatReply 定义");
    const open = src.indexOf("{", start);
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        const ch = src[i];
        if (ch === "{") depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) return src.slice(open, i + 1);
        }
    }
    assert.fail("deliverWechatReply 函数体括号未配平");
}

describe("T8 final 投递就地完成（flush 前移）", () => {
    test("final 分支不再「存起来 + defer」（那是核心看不见的延后投递）", () => {
        assert.doesNotMatch(
            deliveryFnBody(),
            /finalBuffer\.buffer\(args\);[\s\S]{0,500}?return deferWechatDelivery\(\);/,
            "final 分支不得再 buffer 后 defer —— 核心会把延后误记为已投递；" +
                "应改为就地 flush 并把真实结果返回给核心",
        );
    });

    test("final 分支在同一调用栈内 flush 并回传真实结果", () => {
        const src = source();
        // (1) 辅助函数内做真实的就地 flush（复用原有合并/去重契约）
        assert.match(
            src,
            /const flushBufferedFinalReply = async[\s\S]{0,400}?finalBuffer\.flush\(async[\s\S]{0,400}?await deliverWechatReply\(\.\.\.finalReplyArgs\)/,
            "应存在就地 flush 辅助函数：在本次调用栈内 flush 并真实发送",
        );
        // (2) final 分支缓冲后立即调用它，并把真实结果返回给核心
        const body = deliveryFnBody();
        assert.match(
            body,
            /finalBuffer\.buffer\(args\);\s*const flushedResult = await flushBufferedFinalReply\(\);\s*return flushedResult \?\? deferWechatDelivery\(\);/,
            "final 分支必须 buffer 后立即就地 flush，并把真实投递结果返回给核心（不能丢弃）",
        );
    });

    test("回合末不再有 finalBuffer.flush（发送已前移，回合末不应再扣留投递）", () => {
        const src = source();
        const dispatchIdx = src.indexOf("const dispatchResult = dispatchTurn.dispatchResult;");
        assert.ok(dispatchIdx >= 0, "未找到 dispatchResult 赋值");
        assert.doesNotMatch(
            src.slice(dispatchIdx),
            /await finalBuffer\.flush\(/,
            "回合末不应再有 finalBuffer.flush —— 那会让投递发生在核心结算之后（核心看不见）",
        );
    });
});
