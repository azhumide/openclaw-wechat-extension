# WeChat 扩展使用说明

这个扩展用于把 OpenClaw 的 `wechat` 通道接到 `aibot/plugins/OpenClawBridge`，实现：

- 微信消息从 `aibot` 转发到 OpenClaw
- OpenClaw 回复文本、图片、文件、视频到微信
- 通过本地 WebSocket 和媒体下载地址进行桥接

## 目录说明

- `index.ts`：扩展主入口
- `src/config.ts`：本地配置读取与默认值处理
- `openclaw.plugin.json`：插件声明与配置 schema
- `wechat.config.json`：当前实际使用的本地配置文件
- `wechat.config.example.jsonc`：带中文注释的示例配置

## 配置文件

推荐优先修改：

- `wechat.config.json`

示例模板参考：

- `wechat.config.example.jsonc`

当前支持的配置项如下。

### `wsHost`

WeChat Bridge 监听地址。

- 同机或容器内一般保持 `0.0.0.0`
- 如果你只想本机访问，也可以改成 `127.0.0.1`

### `wsPort`

WeChat Bridge 监听端口，默认一般是 `9093`。

这个值必须和 `aibot/plugins/OpenClawBridge/config.toml` 里的 `ws_url` 端口一致。

### `wsPath`

WeChat Bridge 的 WebSocket 路径，默认一般是 `/ws`。

这个值也必须和 `aibot/plugins/OpenClawBridge/config.toml` 里的 `ws_url` 路径一致。

### `bridgeDownloadHost`

给 `OpenClawBridge` 返回媒体下载地址时使用的主机/IP。

- OpenClaw 和 aibot 在同一台机器：填 `127.0.0.1`
- OpenClaw 和 aibot 分别部署在不同机器：填 OpenClaw 所在机器、能被 aibot 访问到的 IP
- 你当前这种局域网部署，可以填类似 `10.10.10.80`

### `bridgeDownloadBaseUrl`

完整媒体下载基础地址，优先级高于 `bridgeDownloadHost`。

适合下面这些场景：

- 你使用了域名
- 你用了 Nginx / Caddy 反向代理
- 你用了 HTTPS

例如：

```json
{
  "bridgeDownloadBaseUrl": "https://wechat.example.com"
}
```

如果留空，扩展会自动组合成：

```text
http://bridgeDownloadHost:wsPort
```

### `workspaceBase`

OpenClaw 的工作目录根路径。

主要用于：

- 把本地文件路径转换成可下载的 `/media/...` 地址
- 在工具返回相对路径时尝试补全真实文件路径

常见示例：

```json
{
  "workspaceBase": "/home/rs/.openclaw/workspace"
}
```

或 Windows：

```json
{
  "workspaceBase": "C:/Users/你的用户名/.openclaw/workspace"
}
```

### `tmpDir`

可选的临时目录。

用于扩展下载、中转或落地临时媒体文件。留空时会回退到：

```text
workspaceBase/downloads
```

### `mediaSearchPaths`

可选的附加媒体搜索目录数组。

当工具返回的是相对路径，或媒体不在 `workspaceBase` 下时，扩展会继续在这些目录中查找。

例如：

```json
{
  "mediaSearchPaths": [
    "/tmp/openclaw",
    "/data/shared_media"
  ]
}
```

## 推荐配置示例

### 1. 同机部署

OpenClaw 和 aibot 在同一台 Linux 主机：

```json
{
  "wsHost": "0.0.0.0",
  "wsPort": 9093,
  "wsPath": "/ws",
  "bridgeDownloadHost": "127.0.0.1",
  "bridgeDownloadBaseUrl": "",
  "workspaceBase": "/home/rs/.openclaw/workspace",
  "tmpDir": "",
  "mediaSearchPaths": []
}
```

### 2. 局域网分机部署

OpenClaw 在 `10.10.10.80`，aibot 在另一台机器：

```json
{
  "wsHost": "0.0.0.0",
  "wsPort": 9093,
  "wsPath": "/ws",
  "bridgeDownloadHost": "10.10.10.80",
  "bridgeDownloadBaseUrl": "",
  "workspaceBase": "/home/rs/.openclaw/workspace",
  "tmpDir": "",
  "mediaSearchPaths": []
}
```

## 与 OpenClawBridge 对接

`aibot/plugins/OpenClawBridge/config.toml` 里至少要保证下面两类配置一致。

### WebSocket 地址一致

例如：

```toml
[openclaw]
ws_url = "ws://127.0.0.1:9093/ws"
```

这里要和本扩展的：

- `wsPort`
- `wsPath`

保持一致。

如果不是同机部署，`ws_url` 里的主机也要改成 OpenClaw 实际可访问地址。

### 媒体下载地址可访问

`OpenClawBridge` 收到文件/图片/视频回调时，会去访问本扩展暴露出来的 `/media/...` 地址。

所以要保证：

- `bridgeDownloadHost` 或 `bridgeDownloadBaseUrl` 是 aibot 能访问到的地址
- `workspaceBase` 配置正确
- OpenClaw 工作目录下的文件对当前运行用户可读

## 配置优先级

当前扩展的读取顺序是：

1. OpenClaw 主配置里的 `channels.wechat`
2. 当前目录下的 `wechat.config.json`
3. 代码默认值

也就是说，如果主配置和 `wechat.config.json` 同时写了同一个字段，主配置优先。

## 常见问题

### 1. 文件发送出去后名字不对

如果日志里 `/media/...` URL 已经带原始文件名，通常不是这个扩展改名，而是下游桥接插件在下载到本地后重新命名了。

### 2. 提示本地文件不存在

优先检查：

- `workspaceBase` 是否正确
- 返回的是绝对路径还是相对路径
- 文件是否真的在 OpenClaw 机器上存在
- 是否需要把额外目录加入 `mediaSearchPaths`

### 3. aibot 下载媒体失败

优先检查：

- `bridgeDownloadHost` 是否填成了错误 IP
- 端口 `9093` 是否被防火墙拦截
- 是否应该改用 `bridgeDownloadBaseUrl`

### 4. 修改配置后没有生效

修改 `wechat.config.json` 后，重启 OpenClaw 扩展或重启整个 OpenClaw 进程再测试。

## 9093 端口排查日志

当前版本已经为 9093 端口相关问题补了更详细的 Bridge 状态日志。

这些日志主要用于排查：

- OpenClaw 重启时端口没有及时释放
- 插件热重载后旧实例残留
- 当前进程里其实还挂着旧的 HTTP / WS server
- 还是外部其他进程真的占用了 `9093`

### 会看到哪些日志

你可能会看到类似下面这些阶段日志：

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

### 日志字段含义

每条状态日志里会包含这些字段：

- `closing`：当前是否处于关闭流程中
- `hasHttp`：是否已有 HTTP server 实例
- `httpListening`：HTTP server 是否真的在监听端口
- `hasWs`：是否已有 WebSocket server 实例
- `wsClients`：当前 WS 客户端连接数
- `hasHeartbeat`：心跳定时器是否存在
- `hasActiveSocket`：是否存在当前桥接连接
- `activeSocketState`：当前桥接连接状态
- `tcpSockets`：底层 TCP 连接数量
- `hasClosePromise`：是否存在尚未完成的关闭流程

### 怎么看这些日志

#### 1. 如果看到 `start:stale-before-cleanup`

说明当前进程检测到了旧的 bridge 对象残留，但这些对象并没有真正处于监听状态，所以插件会先尝试清理再启动。

这通常意味着：

- 上一次关闭不够干净
- 热重载时旧引用还留在全局状态里

#### 2. 如果看到 `start:eaddrinuse-before-cleanup`

说明启动时端口已经被占用，但插件会先做一次清理再重试。

这时候要继续看后面有没有：

- `start:retry-listening`

如果有，说明只是短暂占用，已经恢复。

#### 3. 如果看到 `start:retry-failed`

说明清理和延迟重试之后，`9093` 还是被占着。

这时候大概率不是本插件自己的临时残留，而是：

- 另一个 OpenClaw 进程还在跑
- 其他程序占用了 `9093`
- 系统层面还有未释放的监听实例

#### 4. 如果看到 `close:start:*` 但没有 `close:done:*`

说明关闭流程开始了，但没有完整结束。

这种情况就值得重点怀疑：

- 旧连接没有被完全销毁
- 关闭过程被中断
- OpenClaw 退出得太快

### 你最关心的判断方法

可以简单按这个顺序看：

1. 有没有 `unregister:before`
2. 有没有 `close:start:plugin unregister`
3. 有没有 `close:done:plugin unregister`
4. 重启后有没有 `start:eaddrinuse-before-cleanup`
5. 最后有没有 `start:retry-listening`

如果第 3 步没有，而第 4 步出现了，就基本能确认是“旧实例没关干净”。

如果第 3 步有，但第 5 步还是失败，那更像是“外部其他进程占着 9093”。

## 目录权限说明

这部分很重要，尤其是你这种 OpenClaw 和 aibot 可能跑在 Linux、但本地在 Windows 编辑的场景。

### WeChat 扩展侧至少要有读取权限

下面这些目录，运行 OpenClaw 的用户至少要有“读取”权限：

- `workspaceBase`
- `workspaceBase/downloads`
- `mediaSearchPaths` 里配置的目录
- `tmpDir` 指向的目录

原因是这个扩展需要：

- 读取工具生成的文件
- 把本地文件路径映射成 `/media/...`
- 对外提供媒体下载

如果这些目录不可读，常见现象就是：

- `/media/...` 可以生成，但实际下载 404 / 500
- 日志里提示文件不存在
- 明明工具执行成功了，但微信侧发不出去文件

### aibot / OpenClawBridge 侧通常需要写入权限

`OpenClawBridge` 在处理远程媒体时，通常会把文件落到本地后再发送，所以运行 aibot 的用户一般需要对这些目录有写权限：

- `aibot/files`
- `OpenClawBridge` 运行时使用的临时目录
- 你自己额外指定的缓存目录

如果没有写权限，典型报错就是：

```text
Permission denied
```

例如你之前遇到的这类错误：

```text
/home/rs/aibot/files/xxxx.pptx
```

本质上不是 Windows 里的 `C:\Users\...` 没权限，而是 Linux 运行环境中的 `/home/rs/aibot/files` 对当前进程不可写。

### 最稳妥的权限建议

如果你希望这套桥接稳定工作，建议按这个原则处理：

- OpenClaw 运行用户：对 `workspaceBase` 及相关媒体目录可读
- aibot 运行用户：对 `aibot/files` 可读可写
- 如果 OpenClaw 和 aibot 是同一个系统用户启动，最省事
- 如果是不同用户启动，至少要保证媒体目录和缓存目录具备跨用户可读写权限

### Linux 下建议检查的目录

优先确认下面这些目录权限：

- `/home/rs/.openclaw/workspace`
- `/home/rs/.openclaw/workspace/downloads`
- `/home/rs/aibot/files`

### 判断原则

可以简单记成两句话：

- OpenClaw 扩展负责“读到文件并暴露下载”
- OpenClawBridge 负责“把文件下载下来并写入本地再发送”

所以：

- OpenClaw 那边重点是“可读”
- aibot 那边重点是“可写”

## 建议

- 不确定时，先从 `wechat.config.example.jsonc` 复制一份配置再改
- 同机部署优先用 `127.0.0.1`
- 跨机部署优先确认 aibot 能直接访问 `http://你的IP:9093/media/...`
- `workspaceBase` 尽量显式填写，不要完全依赖自动推断
