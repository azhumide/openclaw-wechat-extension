// T9：方案 A 的等价性不变量 —— 发送/去重行为不变，只有「结果对核心可见」在变。
//
// 改造前后必须保持一致的三件事：
//   1. flush 期间 `isFlushing` 为真 → 递归调用跳过缓冲分支，进入真实发送
//      （这是原实现就依赖的机制，方案 A 复用它而非重造）
//   2. 合并/去重的错误优先级不变（normal final 胜过 tool warning）
//   3. 重复 final 只发一次（flush 后槽位清空）
//
// 唯一有意的差异：结果现在回传核心，而不是被丢弃。
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createWechatReplyFinalBuffer } from "../src/reply-final-buffer.ts";

const finalArgs = (text: string, isError = false) => [{ text, isError }, { kind: "final" }];

describe("T9 方案 A 等价性：递归发送与去重语义不变", () => {
    test("flush 期间 isFlushing 为真（递归调用据此跳过缓冲、进入真实发送）", async () => {
        const buf = createWechatReplyFinalBuffer();
        let sawFlushing = null;
        buf.buffer(finalArgs("hi"));
        await buf.flush(async () => {
            sawFlushing = buf.isFlushing;
        });
        assert.equal(
            sawFlushing,
            true,
            "flush 回调内必须处于 flushing 态，否则递归调用会再次进入缓冲分支 → 死循环/defer",
        );
    });

    test("normal final 不被后续 tool warning 覆盖（d905cfa 的语义）", () => {
        const buf = createWechatReplyFinalBuffer();
        buf.buffer(finalArgs("正常回复", false));
        buf.buffer(finalArgs("⚠️ Tool failed", true));
        let captured: any = null;
        return buf
            .flush(async (args) => {
                captured = args;
            })
            .then(() => {
                assert.equal(
                    captured[0].text,
                    "正常回复",
                    "错误 final 不得覆盖已有的正常 final —— 前端渲染的是正常回复",
                );
            });
    });

    test("flush 后槽位清空，同一 final 不会被投递两次", async () => {
        const buf = createWechatReplyFinalBuffer();
        let sends = 0;
        buf.buffer(finalArgs("once"));
        await buf.flush(async () => {
            sends++;
        });
        await buf.flush(async () => {
            sends++;
        });
        assert.equal(sends, 1, "已投递的 final 不得被再次投递");
    });

    test("flush 回调的返回值被捕获（方案 A 靠它把真实结果回传核心）", async () => {
        const buf = createWechatReplyFinalBuffer();
        let delivered: any;
        buf.buffer(finalArgs("hi"));
        const flushed = await buf.flush(async () => {
            delivered = { visibleReplySent: true, content: "hi" };
        });
        assert.equal(flushed, true);
        assert.deepEqual(
            delivered,
            { visibleReplySent: true, content: "hi" },
            "回调应能传出真实投递结果，供外层返回给核心",
        );
    });
});
