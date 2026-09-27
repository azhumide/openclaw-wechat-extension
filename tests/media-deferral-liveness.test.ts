// T14：媒体延后承诺**不得悬空** —— 端到端补齐「空列表」出口。
//
// 为什么单独一个文件：这个出口最隐蔽，也最危险。核心 await `finalization` 时
// **没有超时保护**，一旦某条出口漏了结算，整个会话永久挂死
// （官方 WhatsApp 源码为此专门写了警告）。
//
// 这条出口的可达路径（生产里真实存在）：
//   1. 第一个媒体-only block 进入延后 → 交出承诺，媒体进 pending 列表
//   2. 第二个媒体-only block 携带**同一媒体**到达
//      → `bufferUnsentMediaOnlyBlock` 因去重回 0 → 不进入延后，回落到正常路径
//      → 媒体被 `sendWechatReplyPayloadMedia` 直接发掉，记入 sentMediaKeys
//   3. 回合末 flush 取出 pending → 被 `!sentMediaKeys.has(key)` 过滤掉 → **空列表**
//   4. 此时第一个承诺仍未结算 → 只能靠「空列表」出口收尾
//
// 若第 4 步只顾 `return`，第一个承诺就永远悬着 —— 变异测试证实这个洞真实存在：
// 把 `settleNothingSent()` 从空列表出口删掉后，T11/T12 全绿（漏测），
// 只有本用例会变红。
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
    resolveReplyDispatchDeliveryOutcome,
    isReplyDispatchDeliveryPending,
} from "./helpers/core-outcome.ts";
import { createHarness } from "./helpers/reply-delivery-harness.ts";
import { writeFileSync } from "node:fs";

function makeProbeFile(name: string): string {
    const p = `/tmp/wechat-test-${name}-${process.pid}.png`;
    writeFileSync(
        p,
        Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
            "base64",
        ),
    );
    return p;
}

describe("T14 媒体延后承诺不得悬空（空列表出口，端到端）", () => {
    test("同一媒体被后续 block 抢先发出 → 首个承诺仍必须落地，核心不 pending", async () => {
        const harness = await createHarness();
        const media = makeProbeFile("stale-promise");

        let firstCaptured: any = null;

        await harness.runTurn(async (deliver) => {
            // 1) 第一个媒体-only block：进入延后，交出承诺
            firstCaptured = await deliver(
                { text: "", mediaUrls: [media], isError: false },
                { kind: "block" },
            );

            // 2) 第二个媒体-only block，携带同一媒体：
            //    去重使它回落到正常路径直接发出 —— 第一个承诺就此失去「真实发送」的机会
            await deliver(
                { text: "", mediaUrls: [media], isError: false },
                { kind: "block" },
            );
        });

        assert.ok(firstCaptured?.finalization, "第一个媒体-only block 必须交出承诺");

        // 关键断言：该承诺必须在有限时间内落地（悬空 = 核心永久挂死）
        const raced = await Promise.race([
            firstCaptured.finalization.then(
                (v: any) => ({ settled: true, kind: "resolved", v }),
                (e: any) => ({ settled: true, kind: "rejected", err: String(e) }),
            ),
            new Promise((r) => setTimeout(() => r({ settled: false }), 2600)),
        ]);

        assert.equal(
            raced.settled,
            true,
            "同一媒体的后续投递抢走了发送机会后，首个延后承诺必须由「空列表」出口结算；" +
                "漏掉它会让核心永久等待这次投递",
        );

        if (raced.kind === "resolved") {
            const merged = { ...firstCaptured, ...raced.v, finalization: undefined };
            assert.equal(
                isReplyDispatchDeliveryPending(merged),
                false,
                "核心不得把这次投递留在 pending",
            );
            assert.equal(resolveReplyDispatchDeliveryOutcome(merged), "delivered-not-visible");
        }
    });
});
