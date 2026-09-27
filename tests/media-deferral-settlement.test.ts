// T11：媒体延后不得挂死核心 —— 每条真实出口都必须在有限时间内结算承诺。
//
// 这是本次改动**风险最高**的一点：核心在 dispatch 内部 await `finalization`
// （src/channels/turn/lifecycle.ts 的 settleChannelDeliveryAttempt）。若某条出口
// 忘了结算，整个会话会永久挂住（没有超时保护）。官方 WhatsApp 插件在源码里
// 专门写了注释警告这个陷阱。
//
// 所以这里不看「实现长什么样」，而是**用真实的槽位跑一遍每条出口**，
// 断言承诺确实会在合理时间内落地，且结果与出口语义一致。
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { createWechatMediaOnlyDeferralSlot } from "../src/reply-media-deferral.ts";

/** 给承诺加超时护栏：若出口漏了结算，这里会失败而不是让测试挂住。 */
function withTimeout(promise, ms, label) {
    return Promise.race([
        promise.then((value) => ({ settled: true, value })),
        new Promise((resolve) => setTimeout(() => resolve({ settled: false, label }), ms)),
    ]);
}

const TIMEOUT_MS = 200;

describe("T11 媒体延后承诺必须落地（防核心挂死）", () => {
    test("定时器到时出口：结算为已投递", async () => {
        const slot = createWechatMediaOnlyDeferralSlot();
        const p = slot.defer();
        slot.settleDelivered();
        const r = await withTimeout(p, TIMEOUT_MS, "timer");
        assert.equal(r.settled, true, "定时器到时必须结算延后，否则核心永久等待");
        assert.equal(r.value.visibleReplySent, true);
    });

    test("被后续文本合并出口：结算为自身无可见投递", async () => {
        const slot = createWechatMediaOnlyDeferralSlot();
        const p = slot.defer();
        slot.settleSuperseded();
        const r = await withTimeout(p, TIMEOUT_MS, "merged");
        assert.equal(r.settled, true, "被文本合并时也必须结算旧承诺");
        assert.equal(r.value.visibleReplySent, false);
    });

    test("无媒可发出口：结算为有意不发", async () => {
        const slot = createWechatMediaOnlyDeferralSlot();
        const p = slot.defer();
        slot.settleNothingSent();
        const r = await withTimeout(p, TIMEOUT_MS, "nothing");
        assert.equal(r.settled, true);
        assert.equal(r.value.suppression?.reason, "no_visible_result");
    });

    test("发送失败出口：拒绝承诺（核心记失败，不记成功、也不挂住）", async () => {
        const slot = createWechatMediaOnlyDeferralSlot();
        const p = slot.defer();
        slot.fail(new Error("media send failed"));
        const r = await withTimeout(p.then(() => "resolved", () => "rejected"), TIMEOUT_MS, "fail");
        assert.equal(r.settled, true, "失败也必须落地（拒绝），否则核心永久等待");
        assert.equal(r.value, "rejected");
    });

    test("同一回合多次延后：旧承诺被接管时立即结算", async () => {
        const slot = createWechatMediaOnlyDeferralSlot();
        const first = slot.defer();
        const second = slot.defer();
        const r = await withTimeout(first, TIMEOUT_MS, "superseded-by-new-defer");
        assert.equal(r.settled, true, "被新延后接管时，旧承诺必须立即结算");
        assert.equal(r.value.visibleReplySent, false);
        slot.settleDelivered();
        assert.equal((await second).visibleReplySent, true);
    });
});
