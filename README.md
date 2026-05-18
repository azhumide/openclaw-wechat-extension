# WeChat 扩展说明

这个扩展用于把 OpenClaw 的 `wechat` 通道接到 `aibot/plugins/OpenClawBridge`，实现微信消息和 OpenClaw 之间的双向桥接。

当前推荐架构是：

- `OpenClawBridge` 做 WebSocket 服务端
- 本扩展做 WebSocket 客户端
- 默认只用一个端口 `9093`

## 当前能力

- 微信入站消息转 OpenClaw 会话
- OpenClaw 文本 / 图片 / 文件 / 视频回发微信
- 单端口 WebSocket 客户端桥接
- 更详细的入站 / 出站 / 连接状态日志
- 基于微信发送者的敏感工具权限控制
- 主人 / 白名单 / 分工具白名单
- 普通用户 skill 黑名单
- 已安装 skill 的 `exec` / `process` 自动放行识别

## 工作链路

整体链路可以简单理解成：

1. 微信消息先进入 `aibot`
2. `aibot/plugins/OpenClawBridge` 作为 WebSocket 服务端接收本扩展连接
3. 本扩展把消息投递成 OpenClaw 的 `wechat` 会话
4. OpenClaw 产出的回复再通过 WebSocket 回给 `OpenClawBridge`
5. 媒体优先直接走本地绝对路径、工作区相对路径或可访问 URL，不再依赖第二个媒体端口

## 目录说明

- `index.ts`
  扩展主入口，负责插件注册、启动/停止编排和各子模块挂接
- `src/bridge-runtime.ts` / `src/bridge-autostart.ts`
  Bridge WebSocket 连接、心跳、重连和自动启动相关逻辑
- `src/inbound-handler.ts` / `src/inbound-context.ts`
  微信入站消息解析、会话上下文和 OpenClaw 投递
- `src/channel.ts`
  `wechat` channel 的插件定义、会话路由和 action/outbound 挂接
- `src/outbound-send.ts`
  文本 / 媒体出站发送，包含本地媒体路径解析、暂存、去重和 Bridge 帧发送
- `src/reply-delivery.ts`
  模型回复分段、最终回复缓冲、媒体候选提取和回发编排
- `src/message-tool.ts`
  `message` 工具参数规范化和 WeChat 目标解析
- `src/tool-auth-*.ts` / `src/installed-skill-*.ts`
  微信发送者敏感工具权限、已安装 skill 自动放行和只读 exec 白名单识别
- `src/canonicalization*.ts`
  WeChat 通道名、会话路由、subagent delivery origin 的兼容规范化
- `src/config.ts`
  本地配置读取、默认值处理、媒体根目录解析
- `src/runtime.ts`
  Bridge 运行时状态、工具权限上下文、skill 进程会话映射
- `wechat.config.json`
  当前实际使用的本地配置
- `wechat.config.example.jsonc`
  带中文注释的配置模板

## 快速开始

### 1. 配置扩展

先准备：

- `.openclaw/extensions/wechat/wechat.config.json`

至少确认这几个字段：

- `wsHost`
- `wsPort`
- `wsPath`
- `workspaceBase`

### 2. 配置 OpenClawBridge

在 `aibot/plugins/OpenClawBridge/config.toml` 里，至少保证下面这些项和扩展一致：

```toml
[openclaw]
ws_mode = "server"
ws_host = "0.0.0.0"
ws_port = 9093
ws_path = "/ws"
```

这里的主机、端口、路径必须和：

- `wsHost`
- `wsPort`
- `wsPath`

保持一致。

### 3. 启动后先看日志

先确认有没有这几类日志：

- 入站日志：`[WeChat Inbound] ...`
- 出站日志：`[WeChat Outbound] ...`
- 连接日志：`Bridge WS client connected` 或 `Connected to OpenClawBridge server`
  也可能显示为：`Bridge WS connected: ws://...`

## 配置读取优先级

当前扩展配置优先级是：

1. OpenClaw 主配置里的 `channels.wechat`
2. `.openclaw/extensions/wechat/wechat.config.json`
3. 代码默认值

## 配置项说明

### Bridge 基础配置

#### `wsHost`

OpenClaw 要连接的 `OpenClawBridge` 服务端地址。

- 同机部署通常用 `127.0.0.1`
- 跨机部署填写 aibot 所在机器 IP

#### `wsPort`

`OpenClawBridge` 服务端端口，默认 `9093`。

#### `wsPath`

`OpenClawBridge` WebSocket 路径，默认 `/ws`。

### 媒体与路径配置

#### `bridgeDownloadHost`

兼容旧模式保留字段。当前主链路通常保持和 `wsHost` 一致即可。

#### `bridgeDownloadBaseUrl`

兼容旧模式保留字段。当前单端口直连模式下通常留空即可。

只有在你明确需要把某些媒体改写成公共下载地址时，它才有意义。

#### `workspaceBase`

OpenClaw 工作目录根路径。

主要用于：

- 对相对路径补全真实路径
- 作为媒体查找根目录
- 让本扩展把工具产出的本地文件解析成可回传路径

Linux 示例：

```json
{
  "workspaceBase": "/home/rs/.openclaw/workspace"
}
```

Windows 示例：

```json
{
  "workspaceBase": "C:/Users/你的用户名/.openclaw/workspace"
}
```

#### `tmpDir`

可选临时目录。留空时会回退到：

```text
workspaceBase/downloads
```

#### `mediaSearchPaths`

附加媒体搜索目录数组。

当工具返回相对路径，或目标文件不在 `workspaceBase` 下时，扩展会继续在这些目录查找。

## 出站消息行为

### 文本回复

会输出类似日志：

```text
[WeChat Outbound] to=xxx account=default type=text text="..."
```

### 媒体回复

会输出类似日志：

```text
[WeChat Outbound] to=xxx account=default type=media media="..."
```

如果传入的是本地路径，扩展会优先：

1. 解析成绝对路径
2. 在 `workspaceBase` / `tmpDir` / `mediaSearchPaths` 范围内补全和查找
3. 尽量直接把本地路径通过桥接帧交给 `OpenClawBridge`

只有在特定兼容场景下，才会退回成 URL。

## 主人 / 白名单 / 审批

### 主人身份怎么判断

这个扩展本身不直接维护主人 wxid。

当前逻辑是：

- 微信入站时，`OpenClawBridge` 负责把 `isMaster` 传过来
- 本扩展只消费这个 `isMaster` 标记

### `nonOwnerToolAuthMode`

非主人调用敏感工具时的总策略。

- `off`
- `deny`
- `approve`

### `nonOwnerToolAuthTools`

需要受上面策略保护的工具名。

建议至少先保护：

```json
["exec", "process"]
```

### `toolAuthBypassWxids`

全局白名单。支持：

- 发送者 wxid
- 私聊场景下 `OpenClawBridge` 传过来的 alias

### `toolAuthBypassByTool`

按工具单独配置白名单。

### `toolAuthAllowInstalledSkills`

是否允许“已安装 skill”触发的敏感工具自动放行。

### `toolAuthAllowMcporterExec`

是否允许非主人执行 `mcporter` MCP CLI 命令。

开启后会放行 `mcporter ...` 和常见的 `npx mcporter ...` 形式，包括 `list` / `call` / `auth` / `config` / `daemon` 等子命令。

仍会拒绝夹带 shell 拼接的命令，例如 `;`、`|`、重定向、命令替换、环境变量展开等。

### `toolAuthBlockedSkills`

skill 黑名单。

### `toolAuthAllowSafeReadonlyExec`

是否允许非主人执行极少数只读低风险 `exec` 命令。

当前只识别固定安全形态，例如：

- `date`
- `pwd`
- `whoami`
- `hostname`
- `uname`
- `id`
- `arch`
- 针对受控目录的 `ls` / `stat` / `readlink`
- 安全只读查询后接一个简单 `head` 截断，例如 `ls -lt <受控目录> | head -n 5`

除上述 `head` 截断特例外，带管道、重定向、命令替换、`;`、`&&`、`||` 等 shell 组合的命令不会放行。

远端媒体下载另有一个收窄的安全下载 bypass：只允许 `wget -O <workspace 路径> <http(s) URL>` 或 `curl -L -o <workspace 路径> <http(s) URL>` 这类输出路径落在 workspace 内的命令。

### `toolAuthDebugInstalledSkills`

是否输出“已安装 skill 自动放行”的调试日志。

排查某条 `exec` / `process` 为什么没有被识别为 skill 调用时，可以临时打开。

### 工具权限通知文案

这些开关控制非主人触发敏感工具时，是否向微信回发提示：

- `toolAuthNotifyBlocked`
- `toolAuthNotifyApprovalQueued`
- `toolAuthNotifyApprovalResolved`
- `toolAuthNotifyInGroup`
- `toolAuthNotifyInDirect`

这些字段可以覆盖默认提示模板：

- `toolAuthMessageBlocked`
- `toolAuthMessageQueued`
- `toolAuthMessageAllowOnce`
- `toolAuthMessageAllowAlways`
- `toolAuthMessageDeny`
- `toolAuthMessageTimeout`
- `toolAuthMessageCancelled`

模板支持占位符：

```text
{{toolName}} {{state}} {{stateLabel}} {{senderId}} {{senderName}} {{skillId}}
{{from}} {{chatType}} {{chatTypeLabel}} {{conversationLabel}} {{question}}
```

## 推荐配置示例

### 同机部署

```json
{
  "wsHost": "127.0.0.1",
  "wsPort": 9093,
  "wsPath": "/ws",
  "bridgeDownloadHost": "127.0.0.1",
  "bridgeDownloadBaseUrl": "",
  "workspaceBase": "/home/rs/.openclaw/workspace",
  "tmpDir": "",
  "mediaSearchPaths": [],
  "nonOwnerToolAuthMode": "deny",
  "nonOwnerToolAuthTools": ["exec", "process"],
  "toolAuthAllowInstalledSkills": false,
  "toolAuthAllowSafeReadonlyExec": false
}
```

### 局域网分机部署

```json
{
  "wsHost": "10.10.10.80",
  "wsPort": 9093,
  "wsPath": "/ws",
  "bridgeDownloadHost": "10.10.10.80",
  "bridgeDownloadBaseUrl": "",
  "workspaceBase": "/home/rs/.openclaw/workspace",
  "tmpDir": "/home/rs/.openclaw/workspace/downloads",
  "mediaSearchPaths": [],
  "nonOwnerToolAuthMode": "approve",
  "nonOwnerToolAuthTools": ["exec", "process"],
  "toolAuthAllowInstalledSkills": false,
  "toolAuthAllowSafeReadonlyExec": false
}
```

## 常见问题

### 1. 连不上 OpenClawBridge

优先检查：

- `wsHost` / `wsPort` / `wsPath` 是否和 `OpenClawBridge` 一致
- OpenClawBridge 是否已经监听 `9093`
- 网络或防火墙是否拦截

### 2. 提示本地文件不存在

优先检查：

- `workspaceBase` 是否正确
- 返回的是绝对路径还是相对路径
- 文件是否真的存在于 OpenClaw 所在机器
- 是否需要把目录补到 `mediaSearchPaths`

### 3. aibot 收到文本，收不到媒体

优先检查：

- OpenClaw 侧回调里给的是本地路径、相对路径还是 URL
- 该路径是否能在 `workspaceBase` 或 `mediaSearchPaths` 中命中
- 是否只有兼容回退场景才需要 `bridgeDownloadBaseUrl`

### 4. 修改配置后没有生效

修改 `wechat.config.json` 后，需要重启扩展或重启整个 OpenClaw 进程。

### 5. 群里没显示昵称 / 群名不对

先看入站日志里有没有：

- `conversation="..."`
- `senderName="..."`

如果日志里已经没有这些字段，说明是 `OpenClawBridge` 上游就没传够，不是这个扩展中途丢掉了。

## 权限建议

运行 OpenClaw 的用户，至少要对这些目录有读取权限：

- `workspaceBase`
- `workspaceBase/downloads`
- `mediaSearchPaths` 里的目录
- `tmpDir` 指向的目录

原因主要是：

- 读取工具产出的文件
- 解析和中转本地媒体

## 使用建议

- 不确定时，先从 `wechat.config.example.jsonc` 复制一份再改
- 同机部署优先用 `127.0.0.1`
- 跨机部署先验证 OpenClaw 到 aibot 的 `9093` 可达
- `workspaceBase` 尽量显式填写，不要完全依赖自动推断
- 如果你在做权限控制，先开 `deny` 跑通，再考虑升级到 `approve`
