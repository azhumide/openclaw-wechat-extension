// 测试台：在进程内驱动**真实**的生产入口 `dispatchWechatReplyForInbound`。
//
// 为什么需要：媒体-only 延后路径在生产里 7 天 0 触发，桥接也没有任何注入接口
// （9093 全 404），且插件是单账号 WS 客户端（第二连接 409）——无法从外部伪造
// 一条入站消息。因此改为进程内驱动真实入口，只替换两个**外部边界**：
//
//   1. 宿主 SDK（`openclaw/plugin-sdk*`）—— 本机没有 node_modules，无法真解析，
//      且它属于宿主，不是被测对象。
//   2. `wechatPlugin.outbound.*` —— 真实实现会打到桥接 WS，会打扰生产连接。
//
// 其余全部是真代码：真实 mediaState（真 1.2s 定时器）、真实槽位、真实发送
// 分支与判定字段。
import { mkdirSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

const DIR = path.join(os.tmpdir(), `wechat-reply-harness-${process.pid}`);

let bootstrapPromise: Promise<Record<string, any>> | null = null;

function stubFiles() {
    mkdirSync(DIR, { recursive: true });

    const sdkStub = path.join(DIR, "sdk-stub.mjs");
    writeFileSync(
        sdkStub,
        `
const passthrough = (x) => x;
const passthroughFn = (...a) => a[0];

// 借这个入口抓取核心传给插件的 deliver 回调（生产里由核心驱动回合）。
export const dispatchChannelInboundTurn = async (params) => {
    globalThis.__WECHAT_HARNESS_DELIVER = params.delivery?.deliver;
    globalThis.__WECHAT_HARNESS_ON_ERROR = params.delivery?.onError;
    return { dispatchResult: { queuedFinal: false, counts: {} } };
};

// 其余 SDK 导出：纯媒体场景用不到交互式菜单，给最小可用替身即可。
export const interactiveReplyToPresentation = () => undefined;
export const normalizeMessagePresentation = passthrough;
export const resolveMessagePresentationButtonAction = () => undefined;
export const resolveMessagePresentationOptionAction = () => undefined;
export const buildChannelOutboundSessionRoute = passthroughFn;
export const createMessageReceiptFromOutboundResults = () => ({});
export const defineChannelMessageAdapter = passthrough;
export const jsonResult = passthroughFn;
export const readReactionParams = () => ({});
export const readStringParam = () => undefined;
export const resolveReactionMessageId = () => undefined;
export const stripChannelTargetPrefix = passthroughFn;
export const stripTargetKindPrefix = passthroughFn;
`,
    );

    const channelStub = path.join(DIR, "channel-stub.mjs");
    writeFileSync(
        channelStub,
        `
const sent = [];
let failMedia = false;

export const __sent = sent;
export const __reset = () => { sent.length = 0; failMedia = false; };
export const __setFailMedia = (v) => { failMedia = v; };

export const wechatPlugin = {
    id: "wechat",
    outbound: {
        deliveryMode: "direct",
        sendText: async (p) => {
            sent.push({ type: "text", to: p.to, text: p.text });
            return { ok: true, channel: "wechat", messageId: "msg-text" };
        },
        sendMedia: async (p) => {
            if (failMedia) {
                throw new Error("harness: simulated bridge failure");
            }
            sent.push({ type: "media", to: p.to, mediaUrl: p.mediaUrl });
            return { ok: true, channel: "wechat", messageId: "msg-media" };
        },
    },
};
`,
    );

    const hook = path.join(DIR, "resolve-hook.mjs");
    writeFileSync(
        hook,
        `
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";

// 路径内联：钩子跑在 loader 的独立线程里，进程 env 在那里不保证可见。
const SDK_STUB = ${JSON.stringify(sdkStub)};
const CHANNEL_STUB = ${JSON.stringify(channelStub)};

export async function resolve(specifier, context, nextResolve) {
    if (specifier === "openclaw/plugin-sdk" || specifier.startsWith("openclaw/plugin-sdk/")) {
        return { url: pathToFileURL(SDK_STUB).href, shortCircuit: true };
    }
    if (specifier.endsWith("channel.js") || specifier.endsWith("channel.ts")) {
        const parent = context.parentURL || "";
        if (parent.includes("/extensions/wechat/src/")) {
            return { url: pathToFileURL(CHANNEL_STUB).href, shortCircuit: true };
        }
    }
    try {
        return await nextResolve(specifier, context);
    } catch (err) {
        if ((specifier.startsWith("./") || specifier.startsWith("../")) && specifier.endsWith(".js")) {
            const base = new URL(specifier, context.parentURL);
            const tsUrl = new URL(base.href.replace(/\\.js$/, ".ts"));
            if (existsSync(fileURLToPath(tsUrl))) {
                return { url: tsUrl.href, shortCircuit: true };
            }
        }
        throw err;
    }
}
`,
    );

    register(pathToFileURL(hook));
}

export function createHarness() {
    bootstrapPromise ??= (async () => {
        stubFiles();
        // 动态 import：必须在钩子注册之后才会命中桩。
        const { dispatchWechatReplyForInbound } = await import("../../src/reply-delivery.ts");
        const channelStub = await import(pathToFileURL(path.join(DIR, "channel-stub.mjs")).href);
        return { dispatchWechatReplyForInbound, channelStub };
    })();

    return bootstrapPromise.then(({ dispatchWechatReplyForInbound, channelStub }) => {
        const logs: Array<[string, string]> = [];
        const api = {
            logger: {
                info: (m: string) => logs.push(["info", String(m)]),
                warn: (m: string) => logs.push(["warn", String(m)]),
                error: (m: string) => logs.push(["error", String(m)]),
                debug: () => {},
            },
        };
        const runtime = {
            channel: {
                reply: {
                    createReplyDispatcherWithTyping: () => ({}),
                    finalizeInboundContext: (c: any) => c,
                },
            },
            logger: api.logger,
        };
        const cfg = { channels: { wechat: {} }, plugins: { entries: {} } };

        let turn = 0;
        return {
            /** 跑一个真实回合：script 里用传入的 deliver 回调模拟 agent 产出。 */
            async runTurn(
                script: (deliver: any) => Promise<any>,
                options: { failMedia?: boolean } = {},
            ) {
                turn += 1;
                const tag = `t${turn}-${Date.now()}`;
                logs.length = 0;
                channelStub.__reset();
                channelStub.__setFailMedia(options.failMedia === true);
                globalThis.__WECHAT_HARNESS_DELIVER = undefined;

                const pending = dispatchWechatReplyForInbound({
                    api,
                    runtime,
                    cfg,
                    inbound: {
                        accountId: "default",
                        chatType: "direct",
                        ctx: {},
                        from: "harness-target",
                        isMaster: true,
                        messageId: `msg-harness-${tag}`,
                        resolvedSenderId: "wxid_harness",
                        resolvedSenderName: "Harness",
                        sessionKey: `agent:main:wechat:direct:harness-${tag}`,
                        sessionChatKey: `harness-${tag}`,
                        upstreamMessageTraceId: `trace-harness-${tag}`,
                    },
                    sendWechatToolAuthNotice: async () => {},
                });

                await new Promise((r) => setTimeout(r, 250));
                const deliver = globalThis.__WECHAT_HARNESS_DELIVER;
                if (typeof deliver !== "function") {
                    throw new Error("harness: 未拿到 deliver 回调（桩未生效）");
                }
                try {
                    return await script(deliver);
                } finally {
                    await pending;
                }
            },
            sent: () => channelStub.__sent.slice(),
            /** 失败 mock 必须在承诺结算后才复位，否则 1.2s 定时器会跑到成功路径。 */
            setFailMedia: (v: boolean) => channelStub.__setFailMedia(v),
            logsMatching: (re: RegExp) => logs.filter(([, m]) => re.test(m)),
            logs: () => logs.slice(),
        };
    });
}
