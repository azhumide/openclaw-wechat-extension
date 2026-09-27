// T10：媒体-only 延后投递的「结果所有权」槽位。
//
// 背景：
//   媒体-only block 不能立即发送 —— 要留 1.2s 窗口等后续文本到达，好把媒体
//   合并进同一次投递。但核心必须知道它的**最终**结果，否则：
//     - 记成「已投递」= 撒谎（P0 之前的裸 return 就是这个病）
//     - 记成 "unknown"  = 诚实但不完整（核心永远看不到这次投递，会报零投递告警）
//   核心为此提供了官方机制 `finalization`：
//     `ChannelDeliveryResult.finalization?: Promise<ChannelDeliveryOutcome>`
//   核心在 dispatch 内部 await 它，并用 resolve 出的字段覆盖记账。
//
// 铁律（WhatsApp 源码同款警告）：**只要存在未结算的延后，就必须结算它**，
// 否则核心永久等待。本槽位把「谁负责结算」收敛到一处，避免每条出口各自漏掉。
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { createWechatMediaOnlyDeferralSlot } from "../src/reply-media-deferral.ts";

describe("T10 媒体延后槽位：每条出口都必须结算", () => {
    test("初始无未结算延后", () => {
        const slot = createWechatMediaOnlyDeferralSlot();
        assert.equal(slot.isOutstanding, false);
    });

    test("defer 后处于未结算态（核心正在等待）", () => {
        const slot = createWechatMediaOnlyDeferralSlot();
        slot.defer();
        assert.equal(slot.isOutstanding, true);
    });

    test("媒体真实发出 → 结算为 visibleReplySent:true", async () => {
        const slot = createWechatMediaOnlyDeferralSlot();
        const p = slot.defer();
        slot.settleDelivered();
        const outcome = await p;
        assert.equal(outcome.visibleReplySent, true);
        assert.equal(slot.isOutstanding, false);
    });

    test("媒体被合并进其它 payload → 结算为「自身无可见投递」，不谎称已发", async () => {
        const slot = createWechatMediaOnlyDeferralSlot();
        const p = slot.defer();
        slot.settleSuperseded();
        const outcome = await p;
        assert.equal(outcome.visibleReplySent, false);
        assert.equal(
            outcome.suppression,
            undefined,
            "被合并不是「有意不发」，不该带 suppression（那会误导核心）",
        );
    });

    test("无媒可发（全为重复）→ 结算为有意不发", async () => {
        const slot = createWechatMediaOnlyDeferralSlot();
        const p = slot.defer();
        slot.settleNothingSent();
        const outcome = await p;
        assert.equal(outcome.visibleReplySent, false);
        assert.equal(outcome.suppression?.reason, "no_visible_result");
    });

    test("投递失败 → 拒绝承诺（核心记为失败，不记为成功）", async () => {
        const slot = createWechatMediaOnlyDeferralSlot();
        const p = slot.defer();
        slot.fail(new Error("bridge down"));
        await assert.rejects(p, /bridge down/);
        assert.equal(slot.isOutstanding, false);
    });

    test("重复结算是无害的（不会二次改变结果）", async () => {
        const slot = createWechatMediaOnlyDeferralSlot();
        const p = slot.defer();
        slot.settleDelivered();
        slot.settleNothingSent();
        slot.settleSuperseded();
        const outcome = await p;
        assert.equal(outcome.visibleReplySent, true, "首次结算结果应保持不变");
    });

    test("同一回合内再次 defer → 先结算上一个，避免它永远悬着", async () => {
        const slot = createWechatMediaOnlyDeferralSlot();
        const first = slot.defer();
        const second = slot.defer();
        const firstOutcome = await first;
        assert.equal(
            firstOutcome.visibleReplySent,
            false,
            "被新的延后接管时，旧承诺必须立即结算（否则核心永久等待）",
        );
        assert.equal(slot.isOutstanding, true, "新的延后仍在等待结算");
        slot.settleDelivered();
        assert.equal((await second).visibleReplySent, true);
    });

    test("每条出口路径都能让承诺落地（无路径留在未结算态）", async () => {
        const paths = ["settleDelivered", "settleSuperseded", "settleNothingSent"];
        for (const method of paths) {
            const slot = createWechatMediaOnlyDeferralSlot();
            const p = slot.defer();
            slot[method]();
            await p;
            assert.equal(slot.isOutstanding, false, `${method} 之后不应仍有未结算延后`);
        }
        const slot = createWechatMediaOnlyDeferralSlot();
        const p = slot.defer();
        slot.fail(new Error("x"));
        await assert.rejects(p);
        assert.equal(slot.isOutstanding, false);
    });
});
