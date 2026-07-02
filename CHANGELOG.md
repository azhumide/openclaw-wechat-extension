# openclaw-wechat-extension 更新日志

## [v1.4.1] - 2026-07-02

### 修复
- **移除废弃钩子**：删除了 `subagent_spawning` 生命周期钩子注册，改用 `subagent_spawned`。消除 OpenClaw 2026.6.11 启动时打印的 deprecation warning（`typed hook "subagent_spawning" is deprecated`），提升启动日志整洁度。此钩子已在 Core 层面被替代，移除不影响任何功能。

# openclaw-wechat-extension 更新日志

## [v1.2.0] - 2026-05-06

### 变更
- **项目清理**：引入 `.gitignore`，移除 `node_modules` 缓存对版本库的污染。
- **构建脚本**：在 `package.json` 中新增 `build` 脚本，支持使用 `esbuild` 进行 ESM 格式构建。
- **内部依赖重构**：更新了 `plugin-sdk-core` 和 `plugin-sdk-channel-actions` 的内部引用路径（从 `Rq2JD8YM` 等旧指纹迁移至 `6xoeEgQi` 等新指纹），确保与最新的 OpenClaw SDK 环境兼容。
- **配置规范化**：移除了 `package.json` 中冗余的 `repository` 和 `keywords` 字段，使配置更符合 Extension 标准。
