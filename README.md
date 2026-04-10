# WeChat 扩展说明

这个扩展用于把 OpenClaw 的 `wechat` 通道接到 `aibot/plugins/OpenClawBridge`，实现微信消息和 OpenClaw 之间的双向桥接。

当前这套扩展除了基础收发消息，还额外补了下面这些能力：

- 微信入站消息转 OpenClaw 会话
- OpenClaw 文本 / 图片 / 文件 / 视频回发微信
- 本地 `/media/...` 下载桥，给 `OpenClawBridge` 拉取媒体
- 更详细的入站 / 出站 / 9093 端口状态日志
- 基于微信发送者的敏感工具权限控制
- 主人 / 白名单 / 分工具白名单
- 普通用户 skill 黑名单
- 已安装 skill 的 `exec` / `process` 自动放行识别

## 工作链路

整体链路可以简单理解成：

1. 微信消息先进入 `aibot`
2. `aibot/plugins/OpenClawBridge` 通过 WebSocket 把消息转给这个扩展
3. 扩展把消息投递成 OpenClaw 的 `wechat` 会话
4. OpenClaw 产出的回复再通过 WebSocket 回给 `OpenClawBridge`
5. 如果回复里有媒体，本扩展会暴露 `/media/...` 下载地址给 `OpenClawBridge`

## 目录说明

- `index.ts`
  扩展主入口，Bridge 建立、媒体服务、微信入站处理、工具权限控制都在这里
- `src/channel.ts`
  `wechat` channel 的 outbound 定义，负责把 OpenClaw 的发送动作转成 Bridge 帧
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

建议先复制 `wechat.config.example.jsonc` 的内容到：

- `.openclaw/extensions/wechat/wechat.config.json`

至少先确认这几个字段：

- `wsPort`
- `wsPath`
- `bridgeDownloadHost` 或 `bridgeDownloadBaseUrl`
- `workspaceBase`

### 2. 配置 OpenClawBridge

在 `aibot/plugins/OpenClawBridge/config.toml` 里，至少保证下面这一项和扩展一致：

```toml
[openclaw]
ws_url = "ws://127.0.0.1:9093/ws"
```

这里的端口和路径必须和：

- `wsPort`
- `wsPath`

保持一致。

### 3. 启动后先看两类日志

先确认有没有这两类日志：

- 入站日志：`[WeChat Inbound] ...`
- 出站日志：`[WeChat Outbound] ...`

如果是 Bridge 端口问题，再看：

- `Bridge state (...)`

## 配置读取优先级

当前扩展配置优先级是：

1. OpenClaw 主配置里的 `channels.wechat`
2. `.openclaw/extensions/wechat/wechat.config.json`
3. 代码默认值

也就是说：

- 如果主配置和 `wechat.config.json` 同时写了同一个字段，主配置优先
- 如果两边都没写，就走代码默认值

## 配置项说明

下面按实际使用频率说明。

### Bridge 基础配置

#### `wsHost`

WeChat Bridge 监听地址。

- 同机 / 容器内，通常用 `0.0.0.0`
- 只希望本机访问，也可以用 `127.0.0.1`

#### `wsPort`

Bridge 监听端口，默认 `9093`。

必须和 `OpenClawBridge` 的 `ws_url` 端口一致。

#### `wsPath`

Bridge WebSocket 路径，默认 `/ws`。

必须和 `OpenClawBridge` 的 `ws_url` 路径一致。

### 媒体下载配置

#### `bridgeDownloadHost`

给 `OpenClawBridge` 返回媒体下载地址时使用的主机 / IP。

常见场景：

- 同机部署：`127.0.0.1`
- 局域网分机部署：OpenClaw 所在机器的局域网 IP，例如 `10.10.10.80`

#### `bridgeDownloadBaseUrl`

完整媒体下载基础地址，优先级高于 `bridgeDownloadHost`。

适用于：

- 使用域名
- 反向代理
- HTTPS

例如：

```json
{
  "bridgeDownloadBaseUrl": "https://wechat.example.com"
}
```

如果留空，扩展会自动拼成：

```text
http://bridgeDownloadHost:wsPort
```

#### `workspaceBase`

OpenClaw 工作目录根路径。

主要用于：

- 把本地文件路径映射成 `/media/...`
- 对相对路径补全真实路径
- 作为媒体查找根目录

常见示例：

```json
{
  "workspaceBase": "/home/rs/.openclaw/workspace"
}
```

Windows：

```json
{
  "workspaceBase": "C:/Users/你的用户名/.openclaw/workspace"
}
```

#### `tmpDir`

可选临时目录。

用于中转媒体文件。留空时会回退到：

```text
workspaceBase/downloads
```

#### `mediaSearchPaths`

附加媒体搜索目录数组。

当工具返回相对路径，或目标文件不在 `workspaceBase` 下时，扩展会继续在这些目录查找。

例如：

```json
{
  "mediaSearchPaths": [
    "/tmp/openclaw",
    "/data/shared_media"
  ]
}
```

## 主人 / 白名单 / 审批

这是当前 README 里最重要的一块。

### 这套权限控制是怎么判断“主人”的

这个扩展本身不直接维护主人 wxid。

当前逻辑是：

- 微信入站时，`OpenClawBridge` 需要把 `isMaster` 一并传过来
- 本扩展只消费这个 `isMaster` 标记

所以真正“谁是主人”，还是由 `OpenClawBridge` 那边的配置决定。

如果 `OpenClawBridge` 没正确传 `isMaster`，这边不会自动推断。

### `nonOwnerToolAuthMode`

非主人调用敏感工具时的总策略。

可选值：

- `off`
  不额外拦截
- `deny`
  直接拒绝
- `approve`
  先进入 OpenClaw 审批，再决定是否继续

### `nonOwnerToolAuthTools`

需要受上面策略保护的工具名。

建议至少先保护：

```json
["exec", "process"]
```

### `toolAuthBypassWxids`

全局白名单。

这些 wxid 或私聊 alias 会像主人一样，跳过敏感工具限制。

支持：

- 发送者 wxid
- 私聊场景下 `OpenClawBridge` 传过来的 alias

### `toolAuthBypassByTool`

按工具单独配置白名单。

例如只允许某人跳过 `process` 限制：

```json
{
  "toolAuthBypassByTool": {
    "process": ["wxid_xxx"]
  }
}
```

### `ownerExecBypassApproval`

主人调用 `exec` 时，扩展会尽量把 `ask` 强制改成 `off`，减少审批弹窗。

注意：

- 这是“尽力而为”
- 如果宿主机上的 `~/.openclaw/exec-approvals.json` 更严格，它仍然会继续生效

## skill 相关权限

### `toolAuthAllowInstalledSkills`

是否允许“已安装 skill”触发的敏感工具自动放行。

打开后，扩展会识别常见 skill wrapper / skill 脚本命令，以及它们后续派生出来的 `process` 会话。

适合的场景：

- 普通用户可以安全使用已经安装好的 skill
- 但不允许他们随意直接调用裸 `exec`

### `toolAuthDebugInstalledSkills`

是否输出“已安装 skill 自动放行”的调试日志。

打开后，当某个 `exec` / `process` 没被识别成 skill 放行时，日志会额外给出失败原因，方便排查。

### `toolAuthBlockedSkills`

skill 黑名单。

命中这些 skillId 的普通用户会被拦截：

- 主人不受影响
- wxid 白名单不受影响

例如：

```json
{
  "toolAuthBlockedSkills": ["gog", "spotify-player"]
}
```

## 微信侧提示文案

### 开关

- `toolAuthNotifyBlocked`
- `toolAuthNotifyApprovalQueued`
- `toolAuthNotifyApprovalResolved`
- `toolAuthNotifyInGroup`
- `toolAuthNotifyInDirect`

控制是否给微信侧回提示，以及提示能不能发在群里 / 私聊里。

### 文案模板

下面这些字段支持自定义：

- `toolAuthMessageBlocked`
- `toolAuthMessageQueued`
- `toolAuthMessageAllowOnce`
- `toolAuthMessageAllowAlways`
- `toolAuthMessageDeny`
- `toolAuthMessageTimeout`
- `toolAuthMessageCancelled`

可用占位符：

- `{{toolName}}`
- `{{state}}`
- `{{stateLabel}}`
- `{{senderId}}`
- `{{senderName}}`
- `{{skillId}}`
- `{{from}}`
- `{{chatType}}`
- `{{chatTypeLabel}}`
- `{{conversationLabel}}`
- `{{question}}`

## 入站消息行为说明

当前扩展会把每条微信入站消息整理出这些上下文：

- `from`
  会话 ID，群聊通常是 `xxx@chatroom`
- `senderId`
  实际发送者 wxid
- `chatType`
  `group` 或 `direct`
- `senderName`
  发送者显示名
- `conversationLabel`
  当前会话显示名
- `isMaster`
  是否主人，由 `OpenClawBridge` 传入

### 群聊里显示的是谁的名字

这里要分两类：

- `conversationLabel`
  群名，优先取 `groupName`，其次才回退到 `fromName` 或 `from`
- `senderName`
  群成员名字，优先取 Bridge 传来的 `senderName`

也就是说：

- 群名和群成员名是分开的
- 到底显示“个人昵称”还是“群昵称”，取决于 `OpenClawBridge` 实际传给本扩展的字段内容
- 本扩展不自己去微信通讯录二次查昵称

### 会看到什么入站日志

典型日志类似：

```text
[WeChat Inbound] from=50540167809@chatroom sender=wxid_xxx chatType=group isMaster=false msgId=msg-xxx conversation="某某群" senderName="张三" text="你点歌用的哪个api"
```

这类日志可以直接用来确认：

- 群聊还是私聊
- 当前发送者 wxid
- 是否被识别成主人
- 群名 / 发送者名有没有正确传入

## 出站消息行为说明

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

如果传入的是本地路径，扩展会：

1. 先解析成绝对路径
2. 必要时复制到可服务目录
3. 转成 `http://.../media/...` 链接
4. 再发给 `OpenClawBridge`

## 推荐配置示例

### 1. 同机部署

```json
{
  "wsHost": "0.0.0.0",
  "wsPort": 9093,
  "wsPath": "/ws",
  "bridgeDownloadHost": "127.0.0.1",
  "bridgeDownloadBaseUrl": "",
  "workspaceBase": "/home/rs/.openclaw/workspace",
  "tmpDir": "",
  "mediaSearchPaths": [],
  "nonOwnerToolAuthMode": "deny",
  "nonOwnerToolAuthTools": ["exec", "process"],
  "toolAuthBypassWxids": [],
  "toolAuthBypassByTool": {},
  "toolAuthBlockedSkills": [],
  "toolAuthAllowInstalledSkills": false,
  "toolAuthDebugInstalledSkills": false,
  "ownerExecBypassApproval": false
}
```

### 2. 局域网分机部署

```json
{
  "wsHost": "0.0.0.0",
  "wsPort": 9093,
  "wsPath": "/ws",
  "bridgeDownloadHost": "10.10.10.80",
  "bridgeDownloadBaseUrl": "",
  "workspaceBase": "/home/rs/.openclaw/workspace",
  "tmpDir": "/home/rs/.openclaw/workspace/downloads",
  "mediaSearchPaths": [],
  "nonOwnerToolAuthMode": "approve",
  "nonOwnerToolAuthTools": ["exec", "process"],
  "toolAuthBypassWxids": ["wxid_owner"],
  "toolAuthBypassByTool": {
    "process": ["wxid_trusted_1"]
  },
  "toolAuthBlockedSkills": [],
  "toolAuthAllowInstalledSkills": true,
  "toolAuthDebugInstalledSkills": true,
  "ownerExecBypassApproval": true
}
```

## 9093 端口排障

当前版本对 9093 端口问题补了更详细的状态日志。

### 常见阶段日志

- `Bridge state (register:init)`
- `Bridge state (start:before-wait)`
- `Bridge state (start:stale-before-cleanup)`
- `Bridge state (start:servers-created)`
- `Bridge state (start:listening)`
- `Bridge state (start:eaddrinuse-before-cleanup)`
- `Bridge state (start:retry-listening)`
- `Bridge state (close:start:plugin unregister)`
- `Bridge state (close:done:plugin unregister)`
- `Bridge state (unregister:before)`

### 关键字段含义

- `closing`
  是否处于关闭流程
- `hasHttp`
  是否已有 HTTP Server
- `httpListening`
  HTTP Server 是否真的处于监听状态
- `hasWs`
  是否已有 WebSocket Server
- `wsClients`
  当前 WS 客户端数
- `hasHeartbeat`
  心跳定时器是否存在
- `hasActiveSocket`
  当前是否有桥接连接
- `activeSocketState`
  当前桥接连接状态
- `tcpSockets`
  底层 TCP 连接数量
- `hasClosePromise`
  是否仍有未完成的关闭流程

### 最简单的判断方法

按这个顺序看：

1. 有没有 `unregister:before`
2. 有没有 `close:start:plugin unregister`
3. 有没有 `close:done:plugin unregister`
4. 重启后有没有 `start:eaddrinuse-before-cleanup`
5. 最后有没有 `start:retry-listening`

判断结论通常是：

- 第 3 步没有，而第 4 步出现
  旧实例没关干净
- 第 3 步有，但第 5 步还是失败
  更像是外部其他进程占用了 9093

## 常见问题

### 1. 文件发送出去后名字不对

如果 `/media/...` URL 已经带原始文件名，通常不是这个扩展改名，而是下游桥接插件在下载后重新命名了。

### 2. 提示本地文件不存在

优先检查：

- `workspaceBase` 是否正确
- 返回的是绝对路径还是相对路径
- 文件是否真的在 OpenClaw 所在机器存在
- 是否需要把目录补到 `mediaSearchPaths`

### 3. aibot 下载媒体失败

优先检查：

- `bridgeDownloadHost` 是否填错
- `bridgeDownloadBaseUrl` 是否更适合当前部署
- 9093 端口是否被防火墙拦截
- `OpenClawBridge` 是否真的能访问 `http://你的地址:9093/media/...`

### 4. 修改配置后没有生效

修改 `wechat.config.json` 后，需要重启扩展或重启整个 OpenClaw 进程。

### 5. 群里没显示昵称 / 群名不对

先看入站日志里有没有：

- `conversation="..."`
- `senderName="..."`

如果日志里已经没有这些字段，说明是 `OpenClawBridge` 上游就没传够，不是这个扩展在中途丢掉了。

### 6. 为什么主人还是会遇到审批

如果你已经开了：

```json
{
  "ownerExecBypassApproval": true
}
```

但仍然弹审批，要继续检查：

- `OpenClawBridge` 是否真的把该发送者标成 `isMaster=true`
- 宿主机上的 `~/.openclaw/exec-approvals.json` 是否更严格

## 权限建议

### OpenClaw 扩展侧至少要可读

运行 OpenClaw 的用户，至少要对这些目录有读取权限：

- `workspaceBase`
- `workspaceBase/downloads`
- `mediaSearchPaths` 里的目录
- `tmpDir` 指向的目录

原因：

- 读取工具产出的文件
- 暴露 `/media/...`
- 给 `OpenClawBridge` 提供下载

### aibot / OpenClawBridge 侧通常要可写

运行 aibot 的用户，通常要对这些目录有写权限：

- `aibot/files`
- `OpenClawBridge` 用到的临时目录
- 你自己配置的缓存目录

### Linux 下建议优先检查

- `/home/rs/.openclaw/workspace`
- `/home/rs/.openclaw/workspace/downloads`
- `/home/rs/aibot/files`

## 使用建议

- 不确定时，先从 `wechat.config.example.jsonc` 复制一份再改
- 同机部署优先用 `127.0.0.1`
- 跨机部署先验证 `OpenClawBridge` 能直接访问媒体下载 URL
- `workspaceBase` 尽量显式填写，不要完全依赖自动推断
- 如果你在做权限控制，先开 `deny` 跑通，再考虑升级到 `approve`
