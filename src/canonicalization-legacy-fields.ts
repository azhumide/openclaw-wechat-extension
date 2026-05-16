import { canonicalWechatChannelId } from "./canonicalization-channel.js";

const WECHAT_LEGACY_CHANNEL_FIELD_NAMES = new Set([
    "channel",
    "lastchannel",
    "replychannel",
    "messagechannel",
    "currentchannelprovider",
    "provider",
    "surface",
    "originatingchannel",
    "sourcechannel",
    "turnsourcechannel",
]);

export function withPatchedWechatLegacyChannelFields(entry: any): { entry: any; changed: boolean } {
    const patchValue = (value: unknown, depth: number): { value: unknown; changed: boolean } => {
        if (!value || typeof value !== "object" || depth > 8) {
            return { value, changed: false };
        }

        if (Array.isArray(value)) {
            let nextArray: unknown[] | undefined;
            value.forEach((item, index) => {
                const patched = patchValue(item, depth + 1);
                if (!patched.changed) {
                    return;
                }
                if (!nextArray) {
                    nextArray = [...value];
                }
                nextArray[index] = patched.value;
            });
            return nextArray ? { value: nextArray, changed: true } : { value, changed: false };
        }

        const source = value as Record<string, unknown>;
        let next: Record<string, unknown> | undefined;
        const ensureNext = () => {
            if (!next) {
                next = { ...source };
            }
            return next;
        };

        for (const [key, fieldValue] of Object.entries(source)) {
            if (WECHAT_LEGACY_CHANNEL_FIELD_NAMES.has(key.toLowerCase())) {
                const canonical = canonicalWechatChannelId(fieldValue);
                if (canonical && fieldValue !== canonical) {
                    ensureNext()[key] = canonical;
                    continue;
                }
            }

            if (fieldValue && typeof fieldValue === "object") {
                const patched = patchValue(fieldValue, depth + 1);
                if (patched.changed) {
                    ensureNext()[key] = patched.value;
                }
            }
        }

        return next ? { value: next, changed: true } : { value, changed: false };
    };

    const patched = patchValue(entry, 0);
    return {
        entry: patched.value,
        changed: patched.changed,
    };
}
