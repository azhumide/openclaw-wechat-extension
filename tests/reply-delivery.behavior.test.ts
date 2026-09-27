// T1–T4：final 合并/去重与抑制判据的行为契约。
//
// 目的：把「投递主链路改造」（P0 方案 A）所依赖的既有行为固定下来。
// 这些测试当前即为绿色 —— 它们是**回归网**，不是待实现的需求。
//
// 断言值均来自对现有实现的实测（见 2026-09-27_133000 附录），非臆测。
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { createWechatReplyFinalBuffer } from "../src/reply-final-buffer.ts";
import {
    deriveWechatIncrementalReplyText,
    isWechatReplyTextRedundantByWhitespace,
    mergeWechatReplyTurnText,
    appendWechatCumulativeSentText,
    stripWechatReplyMediaDirectives,
} from "../src/reply-text.ts";
import { shouldSuppressWechatToolFailureSummary } from "../src/tool-log.ts";

const finalArgs = (text, isError = false) => [{ text, isError }, { kind: "final" }];

describe("T1 finalBuffer：缓冲与 flush 契约", () => {
    test("初始为空，flush 无缓冲内容时返回 false 且不调用回调", async () => {
        const buf = createWechatReplyFinalBuffer();
        assert.equal(buf.count, 0);
        let called = false;
        const flushed = await buf.flush(async () => {
            called = true;
        });
        assert.equal(flushed, false);
        assert.equal(called, false, "空缓冲不应触发发送");
    });

    test("缓冲一个 final 后可 flush，回调收到原参数", async () => {
        const buf = createWechatReplyFinalBuffer();
        buf.buffer(finalArgs("hello"));
        assert.equal(buf.count, 1);

        let captured = null;
        const flushed = await buf.flush(async (args) => {
            captured = args;
        });

        assert.equal(flushed, true);
        assert.equal(captured[0].text, "hello");
        assert.equal(captured[1].kind, "final");
    });

    test("flush 期间 isFlushing 为 true，之后复位", async () => {
        const buf = createWechatReplyFinalBuffer();
        assert.equal(buf.isFlushing, false);
        buf.buffer(finalArgs("x"));

        const seen = [];
        await buf.flush(async () => {
            seen.push(buf.isFlushing);
        });
        assert.deepEqual(seen, [true], "flush 回调内应处于 flushing 态");
        assert.equal(buf.isFlushing, false);
    });

    test("flush 后缓冲清空：再次 flush 返回 false", async () => {
        const buf = createWechatReplyFinalBuffer();
        buf.buffer(finalArgs("once"));
        await buf.flush(async () => {});
        assert.equal(await buf.flush(async () => {}), false, "不应重复投递同一 final");
    });

    test("flush 回调抛错时 isFlushing 仍复位（finally 语义）", async () => {
        const buf = createWechatReplyFinalBuffer();
        buf.buffer(finalArgs("boom"));
        await assert.rejects(async () => {
            await buf.flush(async () => {
                throw new Error("send failed");
            });
        }, /send failed/);
        assert.equal(buf.isFlushing, false, "异常路径也必须复位，否则后续 final 永远被缓冲");
    });

    test("参数被克隆：外部对象后续变更不影响缓冲内容", async () => {
        const buf = createWechatReplyFinalBuffer();
        const payload = { text: "original" };
        buf.buffer([payload, { kind: "final" }]);
        payload.text = "mutated";

        let captured = null;
        await buf.flush(async (args) => {
            captured = args;
        });
        assert.equal(captured[0].text, "original", "应保存快照而非引用");
    });
});

describe("T2 finalBuffer：error 覆盖优先级（实测矩阵）", () => {
    const flushText = async (sequence) => {
        const buf = createWechatReplyFinalBuffer();
        for (const args of sequence) {
            buf.buffer(args);
        }
        let captured = null;
        await buf.flush(async (args) => {
            captured = args[0].text;
        });
        return captured;
    };

    test("normal → normal：后者覆盖前者", async () => {
        assert.equal(
            await flushText([finalArgs("n1"), finalArgs("n2")]),
            "n2",
        );
    });

    test("error → normal：保留 normal（避免用工具失败摘要顶掉正常回复）", async () => {
        assert.equal(
            await flushText([finalArgs("e", true), finalArgs("n")]),
            "n",
        );
    });

    test("normal → error：保留先到的 normal", async () => {
        assert.equal(
            await flushText([finalArgs("n"), finalArgs("e", true)]),
            "n",
        );
    });

    test("error → error：后者覆盖前者", async () => {
        assert.equal(
            await flushText([finalArgs("e1", true), finalArgs("e2", true)]),
            "e2",
        );
    });

    test("count 记录缓冲次数（含被覆盖的）", () => {
        const buf = createWechatReplyFinalBuffer();
        buf.buffer(finalArgs("a"));
        buf.buffer(finalArgs("b"));
        buf.buffer(finalArgs("c"));
        assert.equal(buf.count, 3);
    });
});

describe("T3 文本去重与增量提取", () => {
    test("空白差异视为重复（block 与 final 的格式差异）", () => {
        assert.equal(
            isWechatReplyTextRedundantByWhitespace({
                cumulativeSentText: "你好 世界",
                text: "你好  世界",
            }),
            true,
        );
    });

    test("已有内容之外的新文本不算重复", () => {
        assert.equal(
            isWechatReplyTextRedundantByWhitespace({
                cumulativeSentText: "你好",
                text: "你好，世界",
            }),
            false,
        );
    });

    test("累积为空时不算重复", () => {
        assert.equal(
            isWechatReplyTextRedundantByWhitespace({
                cumulativeSentText: "",
                text: "新内容",
            }),
            false,
        );
    });

    test("完全重复返回空增量（不重发已流式发出的前置内容）", () => {
        assert.equal(deriveWechatIncrementalReplyText("你好", "你好"), "");
    });

    test("前缀命中时只返回新增部分", () => {
        assert.equal(deriveWechatIncrementalReplyText("你好世界", "你好"), "世界");
    });

    test("无累积时返回全文", () => {
        assert.equal(deriveWechatIncrementalReplyText("你好", ""), "你好");
    });

    test("累积在中间命中时截取其后内容", () => {
        assert.equal(
            deriveWechatIncrementalReplyText("前面你好后面", "你好"),
            "后面",
        );
    });

    test("turn 文本重叠合并去重衔接", () => {
        assert.equal(mergeWechatReplyTurnText("你好世界", "世界和平"), "你好世界\n世界和平");
    });

    test("turn 文本完全被包含时不追加", () => {
        assert.equal(mergeWechatReplyTurnText("你好世界", "你好"), "你好世界");
    });

    test("媒体指令在累积时被剔除", () => {
        assert.equal(
            stripWechatReplyMediaDirectives("文本 MEDIA:/tmp/a.png 尾部"),
            "文本  尾部",
        );
        assert.equal(
            appendWechatCumulativeSentText({
                cumulativeSentText: "A",
                textToProcess: "MEDIA:/tmp/a.png",
            }),
            "A",
            "纯媒体指令不应污染累积文本",
        );
    });
});

describe("T4 工具失败摘要抑制（含 post-deny 分支）", () => {
    const suppress = (text, cumulativeSentText = "", isError = true) =>
        shouldSuppressWechatToolFailureSummary({
            payload: { isError },
            text,
            cumulativeSentText,
        });

    test("非 error payload 一律不抑制", () => {
        assert.equal(suppress("Message failed", "", false).matched, false);
    });

    test("error 但文本为空不抑制", () => {
        assert.equal(suppress("   ", "").matched, false);
    });

    test("error 且文本为普通回复不抑制", () => {
        assert.equal(suppress("好的，我来处理").matched, false);
    });

    test("恰好是 'Message failed' 时抑制（internal-tool-failure-summary）", () => {
        assert.deepEqual(suppress("Message failed"), {
            matched: true,
            reason: "internal-tool-failure-summary",
        });
    });

    test("⚠️ 后紧跟无空格工具名 + failed 时抑制", () => {
        assert.equal(suppress("⚠️exec: failed").matched, true);
    });

    test("累积文本含权限拒绝时记为 post-deny（区别于 internal）", () => {
        assert.deepEqual(suppress("⚠️exec: failed", "你没有这个权限"), {
            matched: true,
            reason: "post-deny-tool-failure-summary",
        });
    });

    test("累积文本普通时仍记为 internal", () => {
        assert.equal(
            suppress("⚠️exec: failed", "好的").reason,
            "internal-tool-failure-summary",
        );
    });

    test("英文权限拒绝同样触发 post-deny", () => {
        assert.equal(
            suppress("Message failed", "permission denied").reason,
            "post-deny-tool-failure-summary",
        );
    });
});
