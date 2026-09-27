import {
    interactiveReplyToPresentation,
    normalizeMessagePresentation,
    resolveMessagePresentationButtonAction,
    resolveMessagePresentationOptionAction,
    type MessagePresentation,
} from "openclaw/plugin-sdk/interactive-runtime";
import { rememberWechatInteractiveMenu } from "./runtime.js";

type MenuItem = { label: string; value: string };

function actionValue(action: any): string | undefined {
    if (action?.type === "command") return action.command;
    if (action?.type === "callback") return action.value;
    if (action?.type === "url" || action?.type === "web-app") return action.url;
    return undefined;
}

export function renderWechatInteractiveFallback(params: {
    payload: any;
    sessionKey: string;
    senderId: string;
}): string | undefined {
    let presentation: MessagePresentation | undefined = normalizeMessagePresentation(params.payload?.presentation);
    if (!presentation && params.payload?.interactive) {
        presentation = normalizeMessagePresentation(
            interactiveReplyToPresentation(params.payload.interactive),
        );
    }
    if (!presentation) return undefined;

    const items: MenuItem[] = [];
    const lines: string[] = [];
    if (typeof params.payload?.text === "string" && params.payload.text.trim()) {
        lines.push(params.payload.text.trim());
    }
    if (presentation.title) lines.push(presentation.title);
    for (const block of presentation.blocks) {
        if (block.type === "text" || block.type === "context") {
            lines.push(block.text);
            continue;
        }
        if (block.type === "buttons") {
            for (const button of block.buttons) {
                if (button.disabled) continue;
                const action = resolveMessagePresentationButtonAction(button, { modelPicker: true });
                const value = actionValue(action) ?? button.value;
                if (button.label && value) items.push({ label: button.label, value });
            }
            continue;
        }
        if (block.type === "select") {
            if (block.placeholder) lines.push(block.placeholder);
            for (const option of block.options) {
                const action = resolveMessagePresentationOptionAction(option, { modelPicker: true });
                const value = actionValue(action) ?? option.value;
                if (option.label && value) items.push({ label: option.label, value });
            }
        }
    }
    if (!items.length) return undefined;
    lines.push("请选择：");
    lines.push(...items.map((item, index) => `${index + 1}. ${item.label}`));
    lines.push("请直接回复序号（如 1）");
    rememberWechatInteractiveMenu({
        sessionKey: params.sessionKey,
        senderId: params.senderId,
        items,
        createdAt: Date.now(),
    });
    return lines.join("\n\n");
}
