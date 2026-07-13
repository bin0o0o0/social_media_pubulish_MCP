# social_media_pubulish_MCP

一个轻量级 MCP Server，用 Playwright 在可见浏览器里自动操作社交媒体创作者后台。

> 重要：本项目需要同时安装 Skill 和 MCP，AI Agent 才能稳定识别并正确使用。只装 MCP 不装 Skill，Agent 往往会有工具但不知道流程；只装 Skill 不装 MCP，Agent 知道流程但无法操作浏览器。

当前重点能力：

- 小红书图文：创建草稿，不点击最终发布
- 抖音图文：上传完成后选择“仅自己可见”，再点击发布
- 抖音视频：上传完成后选择“仅自己可见”，再点击发布
- 抖音短信验证码续提交：支持本地常驻 smoke session

项目只使用正常浏览器自动化：

- 不生成内容
- 不绕过验证码
- 不逆向私有接口
- 不保存账号密码

---

## 目录

- [什么是 Skill / MCP](#什么是-skill--mcp)
- [部署步骤](#部署步骤)
- [平台能力](#平台能力)
- [环境要求](#环境要求)
- [安装依赖](#安装依赖)
- [配置 MCP Server](#配置-mcp-server)
- [安装 Skill](#安装-skill)
- [启动 MCP Server](#启动-mcp-server)
- [工具说明](#工具说明)
- [登录和使用流程](#登录和使用流程)
- [Smoke 联调](#smoke-联调)
- [抖音常驻 Smoke Session 控制器](#抖音常驻-smoke-session-控制器)
- [开发验证](#开发验证)
- [安全边界](#安全边界)

---

## 什么是 Skill / MCP

本项目通过两种机制和 AI Agent 协作：

| 机制 | 作用 | 类比 |
| --- | --- | --- |
| Skill | 告诉 Agent“这个项目怎么用”，包括平台流程、约束、已验证经验 | 使用说明书 |
| MCP | 暴露具体工具能力给 Agent，例如打开浏览器、上传文件、点击按钮 | 遥控器 |

只装 MCP 不装 Skill：Agent 有工具但容易乱点。  
只装 Skill 不装 MCP：Agent 知道流程但做不了事。  
两者都装：Agent 才能稳定、安全地执行。

---

## 部署步骤

完整部署建议按这个顺序：

1. `git clone` 项目
2. `npm install`
3. `npm run install-browsers`
4. 配置 MCP Server
5. 安装 Skill
6. 启动 MCP Server 或运行 smoke 测试

---

## 平台能力

| 平台 | 图文 | 视频 | 验证码续提交 |
| --- | --- | --- | --- |
| 小红书 | 支持，草稿 | 暂不支持 | 不需要 |
| 抖音 | 支持，发布前设为仅自己可见 | 支持，发布前设为仅自己可见 | 支持 |

后续平台通过 adapter capability 扩展，避免打乱已跑通的小红书和抖音流程。

---

## 环境要求

- Node.js >= 20
- npm
- 可正常访问目标平台网页
- 首次运行需要安装 Playwright Chromium

当前默认按 npm 方式部署，不需要 Docker。

---

## 安装依赖

```powershell
npm install
npm run install-browsers
```

---

## 配置 MCP Server

MCP Server 通过 stdio 暴露工具，任何支持 MCP 的 Agent 都可以连接。

### 通用启动命令

```bash
node ./node_modules/tsx/dist/cli.mjs ./src/server.ts
```

不要把 MCP 配置成 `npm run dev`，否则一次 stdio 连接会多出一层 npm Node 进程。Agent 管理 MCP stdio 时，也不要再额外手动开一个 `npm run dev`。

### Claude Code（项目级，推荐）

在项目根目录创建 `.claude/settings.json`：

```json
{
  "mcpServers": {
    "social-media-pubulish-mcp": {
      "command": "node",
      "args": ["./node_modules/tsx/dist/cli.mjs", "./src/server.ts"],
      "cwd": "D:/work/2026/code/social_media_skill"
    }
  }
}
```

### Claude Code（全局）

```bash
claude mcp add social-media-pubulish-mcp node ./node_modules/tsx/dist/cli.mjs ./src/server.ts --cwd D:/work/2026/code/social_media_skill
```

### Cursor / Codex / Kimi / DeepSeek / 其他支持 MCP 的 Agent

核心都是告诉 Agent 如何启动这个 server：

```json
{
  "mcpServers": {
    "social-media-pubulish-mcp": {
      "command": "node",
      "args": ["./node_modules/tsx/dist/cli.mjs", "./src/server.ts"],
      "cwd": "D:/work/2026/code/social_media_skill"
    }
  }
}
```

> 提示：如果你换了机器或目录，记得把 `cwd` 改成自己的项目绝对路径。

---

## 安装 Skill

Skill 文件位于 `skills/` 目录，记录了已验证的操作流程和约束。

### Claude Code

```powershell
mkdir -p .claude/skills
cp -r skills/* .claude/skills/
```

### Cursor

把 `skills/` 下对应 `SKILL.md` 内容放到 Cursor Rules / Project Rules，或你的项目级规则目录。

### Codex / Kimi / DeepSeek / 其他 Agent

把 `skills/<name>/SKILL.md` 的内容作为项目上下文或系统提示注入即可。格式本身是通用的，差异只在于不同 Agent 从哪里读取。

### 当前主要 Skill

| Skill | 作用 |
| --- | --- |
| `douyin-private-image-publish` | 抖音图文上传、填写内容、仅自己可见、发布 |
| `douyin-private-video-publish` | 抖音视频上传完成判定、填写内容、仅自己可见、发布 |
| `douyin-verification-workflow` | 抖音短信验证码续提交流程 |
| `xiaohongshu-draft-smoketest` | 小红书图文草稿联调 |

---

## 启动 MCP Server

```powershell
node .\node_modules\tsx\dist\cli.mjs .\src\server.ts
```

如果 MCP 客户端已经配置了上面的 stdio server，通常不需要手动启动。重复启动只会增加 Node 进程，不会提升稳定性。

浏览器会话目录默认在：

```txt
.social-media-mcp/
```

需要复用同一套登录态时，固定设置：

```powershell
$env:SOCIAL_MEDIA_MCP_PROFILE_SUFFIX='douyin-live3'
```

登录态保存在 `.social-media-mcp/` 下。清理重复 Node 进程不会删除登录态；不要删除 `.social-media-mcp/`，除非你明确想重置账号登录状态。

查看当前项目相关的 MCP/worker 进程：

```powershell
npm run mcp:processes
```

只在确认要清理当前仓库启动的 MCP/worker 时执行：

```powershell
npm run mcp:processes:kill
```

这个命令只匹配当前项目路径下的 `src/server.ts` 和 `scripts/smoke-douyin-draft.ts worker` 进程，不会删除 `.social-media-mcp/`。

---

## 工具说明

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

当前 `coverImage` 是可选项；如果不传，走平台默认封面流程。

### `submit_verification_code`

用于抖音短信验证码弹窗续提交：

```json
{
  "platform": "douyin",
  "code": "123456"
}
```

前提：

- 同一个抖音浏览器会话还活着
- 页面正停在验证码弹窗上

---

## 登录和使用流程

1. 调 `open_login_page`
2. 在可见浏览器里手动登录
3. 调 `check_login_status`
4. 小红书图文用 `create_image_post_draft` 创建草稿
5. 抖音图文用 `create_image_post_draft` 完成上传、仅自己可见、发布
6. 抖音视频用 `create_video_post_draft` 完成上传、仅自己可见、发布
7. 如果抖音弹短信验证码，再用 `submit_verification_code` 续提交

不要在同一个 profile 上同时跑多个浏览器自动化进程，否则容易出现 profile 锁定和登录态异常。

---

## Smoke 联调

### 通用 MCP smoke client

```powershell
$env:MCP_SMOKE_TOOL_ARGS_JSON='{"platform":"douyin"}'
npm run smoke:mcp -- check_login_status
```

### 小红书图文草稿

```powershell
$env:SOCIAL_MEDIA_MCP_PROFILE_SUFFIX='smoketest'
npm run smoke:xiaohongshu
```

### 抖音图文 / 视频

为了避免中文在命令行里变成 `????`，推荐把标题、正文、标签写进 UTF-8 JSON 文件，再通过 `DOUYIN_SMOKE_INPUT_FILE` 传入。

图文示例：

```powershell
$env:SOCIAL_MEDIA_MCP_PROFILE_SUFFIX='douyin-live3'
$env:DOUYIN_SMOKE_MODE='image'
$env:DOUYIN_IMAGE_PATHS='D:/path/1.png|D:/path/2.png|D:/path/3.png'
$env:DOUYIN_SMOKE_INPUT_FILE='D:/work/2026/code/life/social_media_skill/.social-media-mcp/douyin-image-smoke.json'
npm run smoke:douyin:start
```

视频示例：

```powershell
$env:SOCIAL_MEDIA_MCP_PROFILE_SUFFIX='douyin-live3'
$env:DOUYIN_SMOKE_MODE='video'
$env:DOUYIN_VIDEO_PATH='D:/absolute/path/video.mp4'
$env:DOUYIN_SMOKE_INPUT_FILE='D:/work/2026/code/life/social_media_skill/.social-media-mcp/douyin-video-smoke.json'
npm run smoke:douyin:start
```

---

## 抖音常驻 Smoke Session 控制器

为了解决“验证码已经发到手机，但几秒或几十秒后你才把验证码发回来”这个现实问题，抖音 smoke 不再是一条一次性命令，而是一个本地常驻 session 控制器。

### 为什么需要它

一次性 smoke 会遇到这个问题：

1. 发布流程走到验证码弹窗
2. 短信已经发出
3. 执行命令结束
4. 浏览器上下文和 MCP 会话一起消失
5. 拿到验证码后，也没有活着的会话去填码和点“验证”

现在改成：

1. `start` 启动后台 worker
2. worker 连接正式 MCP Server
3. worker 持有活着的浏览器上下文
4. 如果遇到验证码弹窗，worker 把状态写入 session 文件并等待
5. 你把验证码发回来后，再执行 `submit`
6. worker 读取验证码，调用 `submit_verification_code`
7. 自动填码并点击“验证”

### 命令

启动会话：

```powershell
npm run smoke:douyin:start
```

如果同一个 `SOCIAL_MEDIA_MCP_PROFILE_SUFFIX` 已有 `running` 或 `awaiting_verification` 的活跃 worker，`start` 会直接返回已有 `sessionId`，不会再启动第二个 worker 去抢同一个浏览器 profile。

查看状态：

```powershell
npm run smoke:douyin:status -- <session-id>
```

等待状态变化：

```powershell
npm run smoke:douyin:watch -- <session-id>
```

提交验证码：

```powershell
npm run smoke:douyin:submit -- <session-id> <code>
```

停止会话：

```powershell
npm run smoke:douyin:stop -- <session-id>
```

### 会话状态文件

保存在：

```txt
.social-media-mcp/douyin-smoke-sessions/
```

每个会话一个 JSON，记录：

- `sessionId`
- 当前状态
- worker pid
- 最近一次 MCP 结果
- 是否在等待验证码
- 你提交的验证码

### 原理

核心很简单：

1. `start` 先创建 session 文件
2. 如果同 profile 已有活跃 session，就复用它
3. 如果没有活跃 session，就在后台启动一个独立 Node worker
4. worker 再启动本仓库正式 MCP Server 的 stdio 会话
5. worker 负责真正调用：
   - `check_login_status`
   - `open_login_page`
   - `create_image_post_draft`
   - `create_video_post_draft`
   - `submit_verification_code`
6. `submit` 命令本身不直接碰浏览器，它只是把验证码写入 session 文件
7. 后台 worker 看到验证码后，再继续提交

也就是说，这里的“跨消息继续”靠的是：

- 一个活着的后台 worker
- 一个活着的 MCP / 浏览器会话
- 一个本地 session 状态文件

### 隐私风险

这套控制器会保存：

- 浏览器登录态  
  保存在 `.social-media-mcp/<platform>-<profileSuffix>/`
- 本地 session 状态 JSON  
  保存在 `.social-media-mcp/douyin-smoke-sessions/`
- 你提交的验证码  
  会短暂写入 session JSON，供后台 worker 继续提交

它不会：

- 保存账号密码
- 逆向私有接口
- 把验证码上传到远端服务
- 把登录态同步到云端

实际风险主要在本机：

1. 如果别人能访问你的电脑和工作目录，就可能看到这些本地状态文件和浏览器 profile
2. 验证码为了跨命令续提交，会短暂落盘
3. 浏览器 profile 目录本身就是本地敏感数据

建议：

- 保持 `.social-media-mcp/` 在 `.gitignore`
- 联调结束后清理不需要的 session 文件
- 用独立 `profileSuffix` 区分测试账号
- 不在多人共用机器上长期保留创作者后台登录态

---

## 开发验证

修改代码后至少运行：

```powershell
npm run typecheck
npm test
```

如果改动影响真实页面流程，再跑对应 smoke。

---

## 安全边界

- 只使用正常浏览器自动化
- 不保存用户名或密码
- 不绕过验证码或平台验证
- 不调用逆向私有接口
- 小红书图文默认只创建草稿
- 抖音图文和抖音视频会发布，但都会先选择“仅自己可见”

---

## 参考

本项目学习了 `flyerhzm/douyin-mcp` 这类项目中简单直接的 Playwright + MCP 组合方式，也参考了多平台发布工具的产品方向，但不会复制 `xiaohongshu-mcp`、`douyin-mcp` 或 `Wechatsync` 的代码。
