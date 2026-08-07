export function createWechatReplyFinalBuffer() {
    let bufferedFinalReply: { args: any[]; isError: boolean } | null = null;
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
            const isError = args[0]?.isError === true;
            // Keep the assistant's normal final when OpenClaw also emits a
            // follow-up tool warning. The frontend renders that normal final.
            if (!bufferedFinalReply || !isError || bufferedFinalReply.isError) {
                bufferedFinalReply = {
                    args: cloneReplyArgs(args),
                    isError,
                };
            }
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
