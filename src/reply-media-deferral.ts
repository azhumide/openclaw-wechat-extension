// 媒体-only 延后投递的「最终结果」槽位。
//
// 媒体-only block 不能立即发送：要留一个短窗口等后续文本到达，才能把媒体合并
// 进同一次投递。但核心必须知道这次投递的**最终**结果，因此不能只返回
// 「延后/未确认」——要把结果所有权显式交给核心。
//
// 核心的官方机制是 `finalization`：
//   `ChannelDeliveryResult.finalization?: Promise<ChannelDeliveryOutcome>`
// 核心在 dispatch 内部 await 它，并用 resolve 出的字段**覆盖**先前的记账
// （见 src/channels/turn/lifecycle.ts 的 settleChannelDeliveryAttempt）。
// 官方 WhatsApp 插件用同一机制处理它的媒体-only 延后。
//
// 铁律：**只要存在未结算的延后，就必须在回合内结算它**。核心在拿到承诺后
// 会一直等；若某条出口忘了结算，整个会话会挂死。本槽位把「谁负责结算」收敛到
// 一处，让所有出口（定时器到时、被文本合并、无媒可发、发送失败、被新延后接管）
// 都走同一个结算入口。
export type WechatMediaOnlyDeferralOutcome = {
    visibleReplySent: boolean;
    content?: string;
    suppression?: { reason: "no_visible_result" };
};

export function createWechatMediaOnlyDeferralSlot() {
    let resolveCurrent: ((outcome: WechatMediaOnlyDeferralOutcome) => void) | null = null;
    let rejectCurrent: ((error: unknown) => void) | null = null;

    const clear = () => {
        resolveCurrent = null;
        rejectCurrent = null;
    };

    const settle = (outcome: WechatMediaOnlyDeferralOutcome) => {
        const resolve = resolveCurrent;
        clear();
        resolve?.(outcome);
    };

    return {
        /**
         * 声明一次延后，返回交给核心的 `finalization` 承诺。
         *
         * 若上一个延后尚未结算（同一回合内再次出现媒体-only block），先把它结算为
         * 「自身无可见投递」—— 否则那个承诺永远不会落地，核心会永久等待。
         */
        defer(): Promise<WechatMediaOnlyDeferralOutcome> {
            settle({ visibleReplySent: false });
            return new Promise<WechatMediaOnlyDeferralOutcome>((resolve, reject) => {
                resolveCurrent = resolve;
                rejectCurrent = reject;
            });
        },

        /** 媒体已真实发出。 */
        settleDelivered(): void {
            settle({ visibleReplySent: true });
        },

        /** 媒体已随其它 payload 发出：本次自身没有可见投递（不谎称已发）。 */
        settleSuperseded(): void {
            settle({ visibleReplySent: false });
        },

        /** 无媒可发（候选全为重复/已发送）：诚实表述为「有意不发」。 */
        settleNothingSent(): void {
            settle({ visibleReplySent: false, suppression: { reason: "no_visible_result" } });
        },

        /** 投递失败：拒绝承诺，让核心记为失败而不是成功。 */
        fail(error: unknown): void {
            const reject = rejectCurrent;
            clear();
            reject?.(error);
        },

        /** 是否存在尚未结算的延后（用于测试与自检）。 */
        get isOutstanding(): boolean {
            return resolveCurrent !== null;
        },
    };
}
