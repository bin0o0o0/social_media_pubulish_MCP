# social_media_pubulish_MCP

一个轻量的 MCP Server，用 Playwright 把你已经准备好的标题、正文、图片或视频自动填写到社交媒体创作者后台。

第一版重点是：

- 小红书图文
- 抖音图文
- 抖音视频
- 本地浏览器会话复用
- 手动登录
- 抖音验证码续提交流程

这个项目只做正常可见浏览器自动化：

- 不生成内容
- 不绕过验证码
- 不逆向私有接口
- 不保存账号密码

## 平台能力

| 平台 | 图文 | 视频 | 验证码续提交 |
| --- | --- | --- | --- |
| 小红书 | 支持 | 暂不支持 | 不需要 |
| 抖音 | 支持 | 支持 | 支持 |

## 安装

```bash
npm install
npm run install-browsers
```

## 启动 MCP Server

```bash
npm run dev
```

服务通过 stdio 暴露 MCP tools。

浏览器会话目录默认在：

```txt
.social-media-mcp/
```

如果你希望复用同一套登录态，可以设置：

```bash
SOCIAL_MEDIA_MCP_PROFILE_SUFFIX
```

例如：

```powershell
$env:SOCIAL_MEDIA_MCP_PROFILE_SUFFIX='douyin-live3'
```

## MCP Tools

### `check_login_status`

```json
{
  "platform": "douyin"
}
```

### `open_login_page`

```json
{
  "platform": "douyin"
}
```

### `create_image_post_draft`

小红书示例：

```json
{
  "platform": "xiaohongshu",
  "title": "Prepared title",
  "content": "Prepared body text.",
  "images": ["D:/absolute/path/cover.png"],
  "tags": ["mcp", "automation"]
}
```

抖音示例：

```json
{
  "platform": "douyin",
  "title": "Prepared image post",
  "content": "Prepared body text.",
  "images": ["D:/absolute/path/cover.png"],
  "tags": ["douyin", "automation"]
}
```

### `create_video_post_draft`

```json
{
  "platform": "douyin",
  "title": "Prepared video post",
  "content": "Prepared video description.",
  "video": "D:/absolute/path/video.mp4",
  "tags": ["douyin", "video"]
}
```

### `submit_verification_code`

用于抖音短信验证码弹窗续提交：

```json
{
  "platform": "douyin",
  "code": "123456"
}
```

这个 tool 的前提是：

- 同一个抖音浏览器会话还活着
- 页面当前正停在验证码弹窗上

## 本地 smoke client

### 通用 MCP smoke client

这是一个本地可直接运行的 stdio MCP client，用来验证任意 tool。

```powershell
$env:MCP_SMOKE_TOOL_ARGS_JSON='{"platform":"douyin"}'
npm run smoke:mcp -- check_login_status
```

它会直接启动本仓库里的正式 MCP Server 入口，而不是走临时脚本旁路。

## 抖音常驻 smoke session 控制器

为了解决“验证码发到手机后，需要过几秒甚至几十秒你再把验证码发回来”的问题，抖音 smoke 不再是一条一次性命令，而是一个本地常驻 session 控制器。

### 为什么要这样做

之前的一次性 smoke 流程会遇到这个问题：

1. 自动发布走到验证码弹窗
2. 短信已经发出
3. 但执行命令已经结束
4. 浏览器上下文和 MCP 会话一起消失
5. 之后即使拿到验证码，也没有活着的会话去填码和点 `验证`

现在改成：

1. `start` 启动一个后台 worker
2. worker 连接正式 MCP Server
3. worker 持有活着的浏览器上下文
4. 如果遇到验证码弹窗，worker 把状态写入 session 文件并等待
5. 你把验证码给我后，我再执行 `submit`
6. worker 读取验证码，调用 `submit_verification_code`
7. 自动填码并点击 `验证`

### 命令

#### 1. 启动会话

```powershell
$env:SOCIAL_MEDIA_MCP_PROFILE_SUFFIX='douyin-live3'
$env:DOUYIN_IMAGE_PATHS='C:\img1.png|C:\img2.png|C:\img3.png'
npm run smoke:douyin:start
```

也可以继续用兼容入口：

```powershell
npm run smoke:douyin
```

启动后会返回一个 `sessionId`。

#### 2. 查看状态

```powershell
npm run smoke:douyin:status -- <session-id>
```

#### 3. 等待状态变化

如果你希望一旦进入 `awaiting_verification` 就立刻返回，而不是自己手动反复查状态，可以直接用：

```powershell
npm run smoke:douyin:watch -- <session-id>
```

默认每 1 秒检查一次。也可以通过环境变量调整：

```powershell
$env:DOUYIN_WATCH_INTERVAL_MS='1000'
$env:DOUYIN_WATCH_TIMEOUT_MS='600000'
```

#### 4. 提交验证码

```powershell
npm run smoke:douyin:submit -- <session-id> <code>
```

例如：

```powershell
npm run smoke:douyin:submit -- douyin-1779791671876-e6ec4671 675221
```

#### 5. 停止会话

```powershell
npm run smoke:douyin:stop -- <session-id>
```

### 会话状态文件

状态文件保存在：

```txt
.social-media-mcp/douyin-smoke-sessions/
```

每个会话一个 JSON 文件，里面会记录：

- `sessionId`
- 当前状态
- worker pid
- 最近一次 MCP 结果
- 是否在等待验证码
- 你提交的验证码

### 这套控制器的原理

核心原理很简单：

1. `start` 命令先创建一个 session 文件
2. 然后在后台启动一个独立 Node worker
3. 这个 worker 再启动本仓库正式 MCP Server 的 stdio 会话
4. worker 负责真正调用：
   - `check_login_status`
   - `open_login_page`
   - `create_image_post_draft`
   - `create_video_post_draft`
   - `submit_verification_code`
5. `submit` 命令本身不直接操作浏览器，它只是把验证码写进 session 文件
6. 后台 worker 看到验证码后，再继续提交

所以这里的“跨消息继续”不是靠聊天上下文魔法，而是靠：

- 一个活着的后台 worker
- 一个活着的 MCP/browser 会话
- 一个本地 session 状态文件

### 隐私风险说明

这套本地常驻 session 控制器有一些明确的边界：

#### 它会保存什么

- 浏览器登录态
  - 保存在 `.social-media-mcp/<platform>-<profileSuffix>/`
- 本地 session 状态 JSON
  - 保存在 `.social-media-mcp/douyin-smoke-sessions/`
- 你提交过的验证码
  - 会短暂写入 session JSON，供后台 worker 继续提交

#### 它不会保存什么

- 不保存账号密码
- 不抓包逆向私有接口
- 不把你的验证码上传到远端服务
- 不把登录态同步到云端

#### 你需要知道的实际风险

1. **本机风险**
   - 如果别人能直接访问你的电脑和工作目录，就可能看到这些本地状态文件和浏览器 profile

2. **验证码短时落盘**
   - 为了跨命令继续，验证码会先写入本地 session 文件
   - 这是这套方案最需要你知情的一点

3. **浏览器登录态属于本地敏感数据**
   - 本地 profile 目录里会包含已登录会话的 cookie / storage
   - 所以不要把 `.social-media-mcp/` 提交到 git，也不要随便共享

#### 风险控制建议

- `.social-media-mcp/` 保持在 `.gitignore`
- 联调完成后删除不需要的 session 文件
- 用独立 profile suffix 区分不同测试账号
- 不在多人共用机器上长期保留创作者后台登录态

## 小红书 smoke

```powershell
$env:SOCIAL_MEDIA_MCP_PROFILE_SUFFIX='smoketest'
npm run smoke:xiaohongshu
```

## 合规边界

- 只使用正常浏览器自动化
- 不保存用户名或密码
- 不绕过验证码或平台安全验证
- 不调用逆向私有接口
- 用户自己决定是否最终发布

## 说明

这个项目借鉴了 Playwright + MCP 这种简单直接的组合方式，但不会复制外部项目代码。
