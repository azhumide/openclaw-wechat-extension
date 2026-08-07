export const wechatChannelConfigSchema = {
    schema: {
        type: "object",
        properties: {
            wsHost: { type: "string", description: "OpenClawBridge WS server host" },
            wsPort: { type: "number", description: "OpenClawBridge WS server port" },
            wsPath: { type: "string", description: "OpenClawBridge WS path" },
            bridgeDownloadHost: { type: "string", description: "Bridge HTTP download host/IP for remote media access" },
            bridgeDownloadBaseUrl: { type: "string", description: "Full public base URL for bridge downloads, e.g. https://example.com" },
            bridgeMediaToken: { type: "string", description: "Shared token for authenticated bridge media upload" },
            workspaceBase: { type: "string", description: "Workspace base path used for temp/download files" },
            tmpDir: { type: "string", description: "Override temp directory for inbound media files" },
            mediaSearchPaths: {
                type: "array",
                description: "Additional directories searched for relative media paths",
                items: { type: "string" },
            },
            redactWxidsInOutboundText: {
                type: "boolean",
                description: "Mask wxid_* identifiers in outbound reply text before sending to the bridge",
            },
            redactWxidsInLogs: {
                type: "boolean",
                description: "Mask wxid_* identifiers in WeChat plugin logs",
            },
            redactExtraWxids: {
                type: "array",
                description: "Additional exact-match WeChat ids to redact, for example custom ids like xdoufux",
                items: { type: "string" },
            },
            nonOwnerToolAuthMode: {
                type: "string",
                description: "How guarded tools behave for non-owner WeChat senders: off | deny | approve",
            },
            nonOwnerToolAuthTools: {
                type: "array",
                description: "Tool names guarded by WeChat owner auth, defaults to exec/process",
                items: { type: "string" },
            },
            toolAuthBypassWxids: {
                type: "array",
                description: "Trusted WeChat sender ids that bypass guarded tool deny/approval checks; supports sender wxid and direct-chat alias",
                items: { type: "string" },
            },
            toolAuthBypassByTool: {
                type: "object",
                description: "Per-tool trusted sender ids; keys are tool names like exec/process and values are arrays of wxids or direct-chat aliases",
                additionalProperties: {
                    type: "array",
                    items: { type: "string" },
                },
            },
            toolAuthAllowInstalledSkills: {
                type: "boolean",
                description: "Allow guarded exec/process calls that match installed skill command patterns, even for non-owner senders",
            },
            toolAuthAllowMcporterExec: {
                type: "boolean",
                description: "Allow non-owner WeChat senders to run mcporter MCP CLI exec commands after basic shell-composition checks",
            },
            ownerExecBypassApproval: {
                type: "boolean",
                description: "Best-effort: force exec ask=off for owner WeChat senders before host exec policy runs",
            },
            toolAuthNotifyBlocked: {
                type: "boolean",
                description: "Whether to send a WeChat notice when a non-owner is directly blocked from guarded tools",
            },
            toolAuthNotifyApprovalQueued: {
                type: "boolean",
                description: "Whether to send a WeChat notice when guarded tool approval has been submitted",
            },
            toolAuthNotifyApprovalResolved: {
                type: "boolean",
                description: "Whether to send a WeChat notice when guarded tool approval resolves",
            },
            toolAuthNotifyInGroup: {
                type: "boolean",
                description: "Whether tool auth notices are allowed in group chats",
            },
            toolAuthNotifyInDirect: {
                type: "boolean",
                description: "Whether tool auth notices are allowed in direct chats",
            },
            toolAuthMessageBlocked: {
                type: "string",
                description: "Custom message template for direct block notices",
            },
            toolAuthMessageQueued: {
                type: "string",
                description: "Custom message template for approval queued notices",
            },
            toolAuthMessageAllowOnce: {
                type: "string",
                description: "Custom message template for allow-once approval notices",
            },
            toolAuthMessageAllowAlways: {
                type: "string",
                description: "Custom message template for allow-always approval notices",
            },
            toolAuthMessageDeny: {
                type: "string",
                description: "Custom message template for denied approval notices",
            },
            toolAuthMessageTimeout: {
                type: "string",
                description: "Custom message template for approval timeout notices",
            },
            toolAuthMessageCancelled: {
                type: "string",
                description: "Custom message template for cancelled approval notices",
            },
        },
    },
};
