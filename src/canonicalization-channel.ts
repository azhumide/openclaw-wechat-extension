import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { WECHAT_LEGACY_ALIAS_PLUGIN_MARKER, wechatPlugin } from "./channel.js";

const WECHAT_LEGACY_CHANNEL_IDS = new Set(["openclaw-weixin", "weixin", "wechatid"]);
const WECHAT_CANONICAL_CHANNEL_ID = "wechat";
const WECHAT_LEGACY_CHANNEL_ALIASES = ["openclaw-weixin", "weixin", "wechatId"];
const pluginRegistryStateSym = Symbol.for("openclaw.pluginRegistryState");

type WechatPluginRegistryGlobalState = {
    activeVersion?: number;
    activeRegistry?: unknown;
    channel?: {
        registry?: unknown;
        version?: number;
    };
};

type WechatPluginRegistryRuntimeModule = {
    getActivePluginRegistry?: () => unknown;
    getActivePluginChannelRegistry?: () => unknown;
};

let wechatPluginRegistryRuntimePromise: Promise<WechatPluginRegistryRuntimeModule | null> | null = null;

export function canonicalWechatChannelId(value: unknown): "wechat" | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === "wechat" || WECHAT_LEGACY_CHANNEL_IDS.has(normalized)) {
        return "wechat";
    }
    return undefined;
}

function wechatPathExists(filePath: string): boolean {
    try {
        return fs.existsSync(filePath);
    } catch {
        return false;
    }
}

function canonicalizeWechatChannelPluginShape(plugin: any): boolean {
    if (!plugin || typeof plugin !== "object") {
        return false;
    }
    if (plugin[WECHAT_LEGACY_ALIAS_PLUGIN_MARKER] === true) {
        return false;
    }

    const rawId = typeof plugin.id === "string" ? plugin.id.trim() : "";
    const rawMetaId = typeof plugin.meta?.id === "string" ? plugin.meta.id.trim() : "";
    const rawAliases = Array.isArray(plugin.meta?.aliases) ? plugin.meta.aliases : [];
    const isWechatish =
        Boolean(canonicalWechatChannelId(rawId)) ||
        Boolean(canonicalWechatChannelId(rawMetaId)) ||
        rawAliases.some((alias: unknown) => Boolean(canonicalWechatChannelId(alias)));

    if (!isWechatish) {
        return false;
    }

    let changed = false;
    if (rawId !== WECHAT_CANONICAL_CHANNEL_ID) {
        plugin.id = WECHAT_CANONICAL_CHANNEL_ID;
        changed = true;
    }

    if (!plugin.meta || typeof plugin.meta !== "object") {
        plugin.meta = {};
        changed = true;
    }

    if (plugin.meta.id !== WECHAT_CANONICAL_CHANNEL_ID) {
        plugin.meta.id = WECHAT_CANONICAL_CHANNEL_ID;
        changed = true;
    }

    const aliases = Array.isArray(plugin.meta.aliases) ? [...plugin.meta.aliases] : [];
    const aliasKeys = new Set(
        aliases
            .filter((alias) => typeof alias === "string")
            .map((alias: string) => alias.trim().toLowerCase())
            .filter(Boolean),
    );
    for (const alias of WECHAT_LEGACY_CHANNEL_ALIASES) {
        const aliasKey = alias.trim().toLowerCase();
        if (!aliasKeys.has(aliasKey)) {
            aliases.push(alias);
            aliasKeys.add(aliasKey);
            changed = true;
        }
    }

    if (changed || plugin.meta.aliases !== aliases) {
        plugin.meta.aliases = aliases;
    }
    return changed;
}

function summarizeWechatChannelRegistryIds(registry: any): string {
    const channels = Array.isArray(registry?.channels) ? registry.channels : [];
    return channels
        .map((entry: any) => typeof entry?.plugin?.id === "string" ? entry.plugin.id : "")
        .filter(Boolean)
        .join(",");
}

function canonicalizeWechatChannelRegistryObject(registry: any): {
    patched: number;
    reordered: number;
    beforeIds: string;
    afterIds: string;
} {
    const beforeIds = summarizeWechatChannelRegistryIds(registry);
    let patched = 0;
    let reordered = 0;
    const lists = [
        Array.isArray(registry?.channels) ? registry.channels : undefined,
        Array.isArray(registry?.channelSetups) ? registry.channelSetups : undefined,
    ].filter(Boolean) as any[][];

    for (const entries of lists) {
        const nativeWechatIndex = entries.findIndex((entry) =>
            typeof entry?.plugin?.id === "string" &&
            entry.plugin.id.trim() === WECHAT_CANONICAL_CHANNEL_ID,
        );
        for (const entry of entries) {
            if (canonicalizeWechatChannelPluginShape(entry?.plugin)) {
                patched += 1;
            }
        }

        const currentIndex = entries.findIndex((entry) => entry?.plugin === wechatPlugin);
        const preferredIndex = currentIndex >= 0 ? currentIndex : nativeWechatIndex;
        if (preferredIndex <= 0) {
            continue;
        }

        const firstWechatIndex = entries.findIndex((entry, index) =>
            index !== preferredIndex && Boolean(canonicalWechatChannelId(entry?.plugin?.id)),
        );
        if (firstWechatIndex >= 0 && firstWechatIndex < preferredIndex) {
            const [preferredEntry] = entries.splice(preferredIndex, 1);
            entries.splice(firstWechatIndex, 0, preferredEntry);
            reordered += 1;
        }
    }

    return {
        patched,
        reordered,
        beforeIds,
        afterIds: summarizeWechatChannelRegistryIds(registry),
    };
}

function bumpWechatChannelRegistryVersion(registries: unknown[]): void {
    const state = (globalThis as Record<symbol, WechatPluginRegistryGlobalState | undefined>)[pluginRegistryStateSym];
    if (!state) {
        return;
    }

    const changedRegistries = registries.filter((registry, index, list) =>
        Boolean(registry) && list.indexOf(registry) === index,
    );
    if (changedRegistries.length === 0) {
        return;
    }

    if (changedRegistries.includes(state.activeRegistry)) {
        state.activeVersion = (state.activeVersion ?? 0) + 1;
    }
    if (state.channel && changedRegistries.includes(state.channel.registry)) {
        state.channel.version = (state.channel.version ?? 0) + 1;
    }
}

export function canonicalizeWechatGlobalChannelRegistry(
    api: OpenClawPluginApi | undefined,
    reason: string,
): number {
    const state = (globalThis as Record<symbol, any>)[pluginRegistryStateSym];
    const registries = [
        state?.channel?.registry,
        state?.activeRegistry,
    ].filter((registry, index, list) => registry && list.indexOf(registry) === index);

    let patched = 0;
    let reordered = 0;
    const beforeIds: string[] = [];
    const afterIds: string[] = [];
    for (const registry of registries) {
        const result = canonicalizeWechatChannelRegistryObject(registry);
        patched += result.patched;
        reordered += result.reordered;
        if (result.patched > 0 || result.reordered > 0) {
            beforeIds.push(result.beforeIds);
            afterIds.push(result.afterIds);
        }
    }

    if (patched > 0 || reordered > 0) {
        bumpWechatChannelRegistryVersion(registries);
        api?.logger.info?.(
            `[WeChat] Canonicalized active channel registry reason=${reason}` +
            ` patched=${patched} reordered=${reordered}` +
            `${beforeIds.length > 0 ? ` ids=${beforeIds.join("|")}=>${afterIds.join("|")}` : ""}`,
        );
    }
    return patched + reordered;
}

async function loadWechatPluginRegistryRuntime(
    api?: OpenClawPluginApi,
): Promise<WechatPluginRegistryRuntimeModule | null> {
    if (!wechatPluginRegistryRuntimePromise) {
        wechatPluginRegistryRuntimePromise = (async () => {
            try {
                const require = createRequire(import.meta.url);
                const sdkCorePath = require.resolve("openclaw/plugin-sdk/core");
                const distDir = path.dirname(path.dirname(sdkCorePath));
                const candidates = [
                    path.join(distDir, "plugins", "runtime.js"),
                    path.join(distDir, "src", "plugins", "runtime.js"),
                ];
                for (const candidate of candidates) {
                    if (!wechatPathExists(candidate)) {
                        continue;
                    }
                    return await import(pathToFileURL(candidate).href) as WechatPluginRegistryRuntimeModule;
                }
                api?.logger.debug?.(
                    `[WeChat] Plugin registry runtime module not found from ${sdkCorePath}`,
                );
            } catch (err: any) {
                api?.logger.debug?.(
                    `[WeChat] Failed to load plugin registry runtime for channel canonicalization err=${err?.message || err}`,
                );
            }
            return null;
        })();
    }
    return wechatPluginRegistryRuntimePromise;
}

export async function canonicalizeWechatCoreRuntimeChannelRegistries(
    api: OpenClawPluginApi | undefined,
    reason: string,
): Promise<number> {
    const runtimeModule = await loadWechatPluginRegistryRuntime(api);
    if (!runtimeModule) {
        return 0;
    }

    const registries = [
        runtimeModule.getActivePluginChannelRegistry?.(),
        runtimeModule.getActivePluginRegistry?.(),
    ].filter((registry, index, list) => registry && list.indexOf(registry) === index);

    let patched = 0;
    let reordered = 0;
    const beforeIds: string[] = [];
    const afterIds: string[] = [];
    for (const registry of registries) {
        const result = canonicalizeWechatChannelRegistryObject(registry);
        patched += result.patched;
        reordered += result.reordered;
        if (result.patched > 0 || result.reordered > 0) {
            beforeIds.push(result.beforeIds);
            afterIds.push(result.afterIds);
        }
    }

    if (patched > 0 || reordered > 0) {
        bumpWechatChannelRegistryVersion(registries);
        api?.logger.info?.(
            `[WeChat] Canonicalized core channel registry reason=${reason}` +
            ` patched=${patched} reordered=${reordered}` +
            `${beforeIds.length > 0 ? ` ids=${beforeIds.join("|")}=>${afterIds.join("|")}` : ""}`,
        );
    }
    return patched + reordered;
}
