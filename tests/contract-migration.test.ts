// T6/T7：投递路径与出站能力位声明契约（P2 + P3）。
//
// 背景：
//   P2 —— 插件原走 `deliverWithProviderMessageSending`（provider funnel，官方定义为
//         "exceptional" 路径）。funnel 的三项义务（assertPlatformSendAuthorized /
//         onPlatformSendDispatch / bindPendingFinalDelivery）本插件一项都没履行，
//         且 funnel 分支会跳过核心侧的 `message_sending` 钩子。
//         迁到标准 `deliver` 分支（路径 ②）后，核心拥有 `message_sending`。
//         该迁移是安全的：`toCoreManagedDeliveryInfo` 保留 `info.kind`（插件只读这个
//         字段），且本部署没有任何插件注册 `message_sending` 钩子
//         （applyMessageSendingHook 在 enabled=false 时原样返回 payload）。
//
//   P3 —— 补 `messageSendingHooks: true`。它在核心 durable 分支是默认必需位
//         （capabilities.ts: `params.messageSendingHooks !== false`）。
//         注意：`queuePolicy:"required"` 还要求 `reconcileUnknownSend`，但它必须是
//         一个能按 messageId 求证「是否已发出」的函数。微信桥接没有对应查询接口，
//         硬声明会让对账无法证明而失败（可能触发重发），故**刻意不声明**。
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const replyDeliverySource = () =>
    readFileSync(join(HERE, "..", "src", "reply-delivery.ts"), "utf8");
const channelSource = () => readFileSync(join(HERE, "..", "src", "channel.ts"), "utf8");

describe("T6 投递走标准 direct 分支（不再使用 provider funnel）", () => {
    test("delivery 声明使用 deliver 键", () => {
        assert.match(
            replyDeliverySource(),
            /delivery:\s*\{[\s\S]*?\bdeliver:\s*deliverWechatReply/,
            "delivery 块必须声明 `deliver: deliverWechatReply`（标准路径 ②）",
        );
    });

    test("不再声明 provider funnel 键", () => {
        assert.doesNotMatch(
            replyDeliverySource(),
            /deliverWithProviderMessageSending/,
            "不应再出现 deliverWithProviderMessageSending —— 那是跳过核心 message_sending 的例外路径",
        );
    });
});

describe("T7 出站能力位声明（P3）", () => {
    test("声明 messageSendingHooks（durable 分支的默认必需位）", () => {
        assert.match(
            channelSource(),
            /capabilities:\s*\{[\s\S]*?messageSendingHooks:\s*true/,
            "durableFinal.capabilities 必须声明 messageSendingHooks: true",
        );
    });

    test("保留 text / media / replyTo", () => {
        for (const bit of ["text", "media", "replyTo"]) {
            assert.match(
                channelSource(),
                new RegExp(`capabilities:\\s*\\{[\\s\\S]*?${bit}:\\s*true`),
                `能力位 ${bit} 不应被移除`,
            );
        }
    });

    test("刻意不声明 reconcileUnknownSend（桥接无按 id 查询接口）", () => {
        assert.doesNotMatch(
            channelSource(),
            /reconcileUnknownSend:\s*true/,
            "reconcileUnknownSend 需要按 messageId 求证发送结果的函数，微信桥接无此接口；" +
                "硬声明会让 exact-delivery 对账失败，可能触发重发",
        );
    });
});
