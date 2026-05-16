export function createWechatReplyFinalBuffer() {
    let bufferedFinalReply: { args: any[] } | null = null;
    let bufferedFinalReplyCount = 0;
    let flushingBufferedFinalReply = false;

    const cloneReplyArgs = (args: any[]) =>
        args.map((arg) => {
            if (Array.isArray(arg)) {
                return [...arg];
            }
            if (arg && typeof arg === "object") {
                return { ...arg };
            }
            return arg;
        });

    return {
        get count() {
            return bufferedFinalReplyCount;
        },
        get isFlushing() {
            return flushingBufferedFinalReply;
        },
        buffer(args: any[]) {
            bufferedFinalReply = {
                args: cloneReplyArgs(args),
            };
            bufferedFinalReplyCount += 1;
            return bufferedFinalReplyCount;
        },
        async flush(flushFn: (args: any[]) => Promise<void>) {
            if (!bufferedFinalReply) {
                return false;
            }
            const finalToFlush = bufferedFinalReply;
            bufferedFinalReply = null;
            flushingBufferedFinalReply = true;
            try {
                await flushFn(finalToFlush.args);
            } finally {
                flushingBufferedFinalReply = false;
            }
            return true;
        },
    };
}
