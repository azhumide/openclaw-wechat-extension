import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { canonicalWechatChannelId } from "./canonicalization-channel.js";
import {
    normalizeWechatSubagentDeliveryOrigin,
    wechatDeliveryOriginsEqual,
    type WechatDeliveryOrigin,
} from "./canonicalization-origin.js";
import { withPatchedWechatLegacyChannelFields } from "./canonicalization-legacy-fields.js";

export {
    canonicalWechatChannelId,
    canonicalizeWechatCoreRuntimeChannelRegistries,
    canonicalizeWechatGlobalChannelRegistry,
} from "./canonicalization-channel.js";
export {
    normalizeWechatMessageToolTarget,
    normalizeWechatSubagentDeliveryOrigin,
    parseWechatDeliveryRouteFromSessionKey,
} from "./canonicalization-origin.js";
export type { WechatDeliveryOrigin } from "./canonicalization-origin.js";
export {
    canonicalizeWechatSessionStoreRouteForConfig,
    recordWechatInboundSessionRoute,
    refreshWechatDirectSessionDisplayName,
} from "./canonicalization-session-store.js";

type WechatSubagentRegistryRuntimeModule = {
    getSubagentRunByChildSessionKey?: (childSessionKey: string) => unknown;
    getLatestSubagentRunByChildSessionKey?: (childSessionKey: string) => unknown;
    listSubagentRunsForRequester?: (requesterSessionKey: string) => unknown[];
    addSubagentRunForTests?: (entry: unknown) => void;
};

let wechatSubagentRegistryRuntimePromise: Promise<WechatSubagentRegistryRuntimeModule | null> | null = null;

async function loadWechatSubagentRegistryRuntime(
    api?: OpenClawPluginApi,
): Promise<WechatSubagentRegistryRuntimeModule | null> {
    if (!wechatSubagentRegistryRuntimePromise) {
        wechatSubagentRegistryRuntimePromise = (async () => {
            try {
                const require = createRequire(import.meta.url);
                const sdkCorePath = require.resolve("openclaw/plugin-sdk/core");
                const distDir = path.dirname(path.dirname(sdkCorePath));
                const candidates = [
                    path.join(distDir, "agents", "subagent-registry.js"),
                    path.join(distDir, "src", "agents", "subagent-registry.js"),
                ];
                for (const candidate of candidates) {
                    if (!wechatPathExists(candidate)) {
                        continue;
                    }
                    return await import(pathToFileURL(candidate).href) as WechatSubagentRegistryRuntimeModule;
                }
                api?.logger.debug?.(
                    `[WeChat] Subagent registry runtime module not found from ${sdkCorePath}`,
                );
            } catch (err: any) {
                api?.logger.debug?.(
                    `[WeChat] Failed to load subagent registry runtime for in-memory canonicalization err=${err?.message || err}`,
                );
            }
            return null;
        })();
    }
    return wechatSubagentRegistryRuntimePromise;
}

export async function canonicalizeWechatActiveSubagentRuntimeOrigins(params: {
    api: OpenClawPluginApi;
    childRunId?: string;
    childSessionKey?: string;
    requesterSessionKey?: string;
    reason?: string;
}): Promise<number> {
    const runtimeModule = await loadWechatSubagentRegistryRuntime(params.api);
    if (!runtimeModule) {
        return 0;
    }

    const candidates: unknown[] = [];
    const addCandidate = (entry: unknown) => {
        if (!isWechatPlainObject(entry)) {
            return;
        }
        candidates.push(entry);
    };

    const childSessionKey = params.childSessionKey?.trim();
    if (childSessionKey) {
        addCandidate(runtimeModule.getSubagentRunByChildSessionKey?.(childSessionKey));
        addCandidate(runtimeModule.getLatestSubagentRunByChildSessionKey?.(childSessionKey));
    }

    const requesterSessionKey = params.requesterSessionKey?.trim();
    if (requesterSessionKey && typeof runtimeModule.listSubagentRunsForRequester === "function") {
        for (const entry of runtimeModule.listSubagentRunsForRequester(requesterSessionKey) || []) {
            if (!isWechatPlainObject(entry)) {
                continue;
            }
            const runId = typeof entry.runId === "string" ? entry.runId.trim() : "";
            const entryChildSessionKey =
                typeof entry.childSessionKey === "string" ? entry.childSessionKey.trim() : "";
            if (
                (params.childRunId && runId && runId !== params.childRunId) ||
                (childSessionKey && entryChildSessionKey && entryChildSessionKey !== childSessionKey)
            ) {
                continue;
            }
            addCandidate(entry);
        }
    }

    const seen = new Set<string>();
    let patchedCount = 0;
    for (const candidate of candidates) {
        if (!isWechatPlainObject(candidate)) {
            continue;
        }
        const runId =
            typeof candidate.runId === "string" && candidate.runId.trim()
                ? candidate.runId.trim()
                : `object:${seen.size}`;
        if (seen.has(runId)) {
            continue;
        }
        seen.add(runId);

        const patched = withPatchedWechatSubagentRunRecord(candidate);
        if (!patched.changed || !isWechatPlainObject(patched.entry)) {
            continue;
        }

        Object.assign(candidate, patched.entry);
        if (typeof candidate.runId === "string" && candidate.runId.trim()) {
            runtimeModule.addSubagentRunForTests?.(candidate);
        }
        patchedCount += 1;
    }

    if (patchedCount > 0) {
        params.api.logger.info?.(
            `[WeChat] Canonicalized active subagent runtime origins` +
            `${params.reason ? ` reason=${params.reason}` : ""}` +
            `${params.childRunId ? ` runId=${params.childRunId}` : ""}` +
            `${params.childSessionKey ? ` child=${params.childSessionKey}` : ""}` +
            `${params.requesterSessionKey ? ` requester=${params.requesterSessionKey}` : ""}` +
            ` patched=${patchedCount}`,
        );
    }
    return patchedCount;
}

function resolveWechatHomeDir(): string {
    const homeDir =
        process.env.OPENCLAW_HOME?.trim() ||
        process.env.HOME?.trim() ||
        process.env.USERPROFILE?.trim() ||
        os.homedir();
    return path.resolve(homeDir || process.cwd());
}

function resolveWechatUserPath(rawPath: string): string {
    const trimmed = rawPath.trim();
    if (trimmed === "~") {
        return resolveWechatHomeDir();
    }
    if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) {
        return path.resolve(path.join(resolveWechatHomeDir(), trimmed.slice(2)));
    }
    return path.resolve(trimmed);
}

function wechatPathExists(filePath: string): boolean {
    try {
        return fs.existsSync(filePath);
    } catch {
        return false;
    }
}

function resolveWechatStateDirForRegistry(): string {
    const explicitStateDir = process.env.OPENCLAW_STATE_DIR?.trim();
    if (explicitStateDir) {
        return resolveWechatUserPath(explicitStateDir);
    }

    const homeDir = resolveWechatHomeDir();
    const newStateDir = path.join(homeDir, ".openclaw");
    if (process.env.OPENCLAW_TEST_FAST === "1" || wechatPathExists(newStateDir)) {
        return newStateDir;
    }

    const legacyStateDir = path.join(homeDir, ".clawdbot");
    if (wechatPathExists(legacyStateDir)) {
        return legacyStateDir;
    }
    return newStateDir;
}

function resolveWechatSubagentRegistryPath(): string {
    return path.join(resolveWechatStateDirForRegistry(), "subagents", "runs.json");
}

function isWechatPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function withCanonicalWechatOriginOnObject(params: {
    value: Record<string, unknown>;
    originKey: string;
    sessionKey?: unknown;
}): { value: Record<string, unknown>; changed: boolean } {
    const sessionKey = typeof params.sessionKey === "string" ? params.sessionKey : undefined;
    const existingOrigin = isWechatPlainObject(params.value[params.originKey])
        ? params.value[params.originKey] as WechatDeliveryOrigin
        : undefined;
    const normalized = normalizeWechatSubagentDeliveryOrigin({
        origin: existingOrigin,
        requesterSessionKey: sessionKey,
    });
    if (!normalized || wechatDeliveryOriginsEqual(existingOrigin, normalized.origin)) {
        return { value: params.value, changed: false };
    }
    return {
        value: {
            ...params.value,
            [params.originKey]: normalized.origin,
        },
        changed: true,
    };
}

function withPatchedWechatSubagentRunRecord(entry: unknown): { entry: unknown; changed: boolean } {
    if (!isWechatPlainObject(entry)) {
        return { entry, changed: false };
    }

    const recursivePatched = withPatchedWechatLegacyChannelFields(entry);
    let next = recursivePatched.entry;
    let changed = recursivePatched.changed;
    const ensureRunObject = () => next as Record<string, unknown>;

    const topOriginPatch = withCanonicalWechatOriginOnObject({
        value: ensureRunObject(),
        originKey: "requesterOrigin",
        sessionKey: ensureRunObject().requesterSessionKey,
    });
    if (topOriginPatch.changed) {
        next = topOriginPatch.value;
        changed = true;
    }

    const runObject = ensureRunObject();
    if (isWechatPlainObject(runObject.pendingFinalDeliveryPayload)) {
        const payload = runObject.pendingFinalDeliveryPayload;
        const payloadOriginPatch = withCanonicalWechatOriginOnObject({
            value: payload,
            originKey: "requesterOrigin",
            sessionKey: payload.requesterSessionKey || runObject.requesterSessionKey,
        });
        if (payloadOriginPatch.changed) {
            next = {
                ...runObject,
                pendingFinalDeliveryPayload: payloadOriginPatch.value,
            };
            changed = true;
        }
    }

    return { entry: next, changed };
}

export async function canonicalizeWechatSubagentRegistryOrigins(params: {
    api: OpenClawPluginApi;
    childRunId?: string;
    requesterSessionKey?: string;
    reason?: string;
}) {
    const registryPath = resolveWechatSubagentRegistryPath();
    if (!wechatPathExists(registryPath)) {
        return;
    }

    try {
        const raw = await fs.promises.readFile(registryPath, "utf8");
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (!isWechatPlainObject(parsed.runs)) {
            return;
        }

        let nextRuns: Record<string, unknown> | undefined;
        let patchedCount = 0;
        const ensureRuns = () => {
            if (!nextRuns) {
                nextRuns = { ...(parsed.runs as Record<string, unknown>) };
            }
            return nextRuns;
        };

        for (const [runId, runEntry] of Object.entries(parsed.runs)) {
            const patched = withPatchedWechatSubagentRunRecord(runEntry);
            if (!patched.changed) {
                continue;
            }
            ensureRuns()[runId] = patched.entry;
            patchedCount += 1;
        }

        if (!nextRuns || patchedCount === 0) {
            return;
        }

        const nextRegistry = {
            ...parsed,
            runs: nextRuns,
        };
        await fs.promises.mkdir(path.dirname(registryPath), { recursive: true });
        const tmpPath = `${registryPath}.${process.pid}.${Date.now()}.tmp`;
        await fs.promises.writeFile(tmpPath, `${JSON.stringify(nextRegistry, null, 2)}\n`, "utf8");
        await fs.promises.rename(tmpPath, registryPath);
        params.api.logger.info?.(
            `[WeChat] Canonicalized subagent registry origins` +
            `${params.reason ? ` reason=${params.reason}` : ""}` +
            `${params.childRunId ? ` runId=${params.childRunId}` : ""}` +
            `${params.requesterSessionKey ? ` requester=${params.requesterSessionKey}` : ""}` +
            ` patched=${patchedCount}`,
        );
    } catch (err: any) {
        params.api.logger.warn?.(
            `[WeChat] Failed to canonicalize subagent registry origins` +
            `${params.reason ? ` reason=${params.reason}` : ""}` +
            `${params.childRunId ? ` runId=${params.childRunId}` : ""}` +
            ` path=${registryPath} err=${err?.message || err}`,
        );
    }
}
