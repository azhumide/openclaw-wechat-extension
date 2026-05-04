# openclaw-wechat-extension 更新日志

## [v1.2.0] - 2026-05-06

### 变更
- **项目清理**：引入 `.gitignore`，移除 `node_modules` 缓存对版本库的污染。
- **构建脚本**：在 `package.json` 中新增 `build` 脚本，支持使用 `esbuild` 进行 ESM 格式构建。
- **内部依赖重构**：更新了 `plugin-sdk-core` 和 `plugin-sdk-channel-actions` 的内部引用路径（从 `Rq2JD8YM` 等旧指纹迁移至 `6xoeEgQi` 等新指纹），确保与最新的 OpenClaw SDK 环境兼容。
- **配置规范化**：移除了 `package.json` 中冗余的 `repository` 和 `keywords` 字段，使配置更符合 Extension 标准。
