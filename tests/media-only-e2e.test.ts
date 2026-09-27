// T12：媒体-only 延后投递的端到端行为（真实生产代码，非结构断言）。
//
// 为什么单独一个文件：这条路径在生产里 **7 天 0 触发**（`Kind=block` 全带文本），
// 桥接又没有任何注入接口（9093 全 404），且插件是单账号 WS 客户端（第二连接 409
// —— 不能旁路连一个去伪造入站）。所以根本无法「发一条真实消息」来打这条路径。
//
// 办法：在进程内驱动**真实的生产入口** `dispatchWechatReplyForInbound`，
// 只把两个外部边界替换成桩：
//   1. 宿主 SDK（本机无 node_modules，无法真解析）
//   2. wechatPlugin.outbound.*（真实实现 = 打到桥接 WS，会打扰生产连接）
// 其余全部是真代码：真 mediaState、真 1.2s 定时器、真槽位、真发送链路、真判定字段。
//
// 这里断言的是**核心最终会给这次投递记什么账**，而这正是本次修复的目标。
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";

import {
    resolveReplyDispatchDeliveryOutcome,
    isReplyDispatchDeliveryPending,
} from "./helpers/core-outcome.ts";
import { createHarness } from "./helpers/reply-delivery-harness.ts";

const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
    "base64",
);

function makeProbeFile(name: string): string {
    const p = `/tmp/wechat-test-${name}-${process.pid}.png`;
    writeFileSync(p, PNG);
    return p;
}

/** 把承诺的最终结果合并回初始返回，复刻核心的结算方式。 */
function settle(initial: any, resolved: any) {
    const merged = { ...initial, ...resolved, finalization: undefined };
    return {
        outcome: resolveReplyDispatchDeliveryOutcome(merged),
        pending: isReplyDispatchDeliveryPending(merged),
    };
}

describe("T12 媒体-only 延后：核心最终记账（端到端真实代码）", () => {
    test("窗口到时发出媒体 → 核心记 delivered，且不是 pending", async () => {
        const harness = await createHarness();
        const media = makeProbeFile("timeout");
        assert.ok(existsSync(media));

        let captured: any = null;
        await harness.runTurn(async (deliver) => {
            captured = await deliver({ text: "", mediaUrls: [media], isError: false }, { kind: "block" });
        });

        assert.ok(captured?.finalization, "媒体-only 延后必须交出 finalization 承诺");
        assert.equal(
            harness.sent().filter((s: any) => s.type === "media").length,
            0,
            "交出承诺时还没到窗口，不应已发送",
        );

        const resolved = await captured.finalization;
        const sentMedia = harness.sent().filter((s: any) => s.type === "media");
        assert.equal(sentMedia.length, 1, "窗口到时必须真的发出媒体");

        const { outcome, pending } = settle(captured, resolved);
        assert.equal(outcome, "delivered");
        assert.equal(pending, false, "核心不得把这次投递留在 pending（那会永久等待）");
    });

    test("媒体被后续文本合并 → 旧承诺立即结算，核心不 pending", async () => {
        const harness = await createHarness();
        const media = makeProbeFile("merge");

        let captured: any = null;
        await harness.runTurn(async (deliver) => {
            captured = await deliver({ text: "", mediaUrls: [media], isError: false }, { kind: "block" });
            // 紧随其后的文本：应把缓冲中的媒体合并进这次投递
            await deliver(
                { text: "随后的文字说明", mediaUrls: [media], isError: false },
                { kind: "final" },
            );
        });

        assert.ok(captured?.finalization);
        assert.ok(
            harness.logsMatching(/Merging buffered media-only block into text reply/).length > 0,
            "应触发合并路径",
        );

        // 被合并后旧承诺必须已落地（不能悬空 —— 悬空 = 核心永久等待）
        const raced = await Promise.race([
            captured.finalization.then((v: any) => ({ settled: true, v })),
            new Promise((r) => setTimeout(() => r({ settled: false }), 300)),
        ]);
        assert.equal(raced.settled, true, "被合并的旧承诺必须立即结算");
        const { pending } = settle(captured, raced.v);
        assert.equal(pending, false);
    });

    test("媒体发送失败 → 承诺 reject，核心记失败而非成功", async () => {
        const harness = await createHarness();
        const media = makeProbeFile("fail");

        let captured: any = null;
        await harness.runTurn(
            async (deliver) => {
                captured = await deliver({ text: "", mediaUrls: [media], isError: false }, { kind: "block" });
            },
            { failMedia: true, keepFailureMockUntil: "promise-settled" },
        );

        assert.ok(captured?.finalization, "即使会失败，也必须先交出承诺");
        const raced = await Promise.race([
            captured.finalization.then(
                (v: any) => ({ settled: true, kind: "resolved", v }),
                (e: any) => ({ settled: true, kind: "rejected", err: String(e) }),
            ),
            new Promise((r) => setTimeout(() => r({ settled: false }), 2600)),
        ]);

        assert.equal(raced.settled, true, "失败也必须结算承诺，否则核心永久等待");
        assert.equal(raced.kind, "rejected", "发送失败必须 reject，不得 resolve 成成功");
        assert.ok(
            harness.logsMatching(/Deferred media-only flush failed/).length > 0,
            "定时器路径的失败必须被记录，不能变成 unhandledRejection",
        );
    });
});
