# social_media_pubulish_MCP

一个轻量级 MCP Server，用 Playwright 在可见浏览器里自动操作社交媒体创作者后台。

当前能力重点：

- 小红书图文：创建草稿，不点击最终发布。
- 抖音图文：上传完成后选择“仅自己可见”，再点击发布。
- 抖音视频：上传完成后选择“仅自己可见”，再点击发布。

项目只使用正常浏览器自动化，不生成内容，不绕过验证码，不逆向私有接口。账号登录、扫码、验证码等都需要按平台正常流程人工完成。

## 平台能力

| 平台 | 图文草稿 | 视频流程 | 文章草稿 |
| --- | --- | --- | --- |
| 小红书 | 支持 | 不支持 | 不支持 |
| 抖音 | 支持，仅自己可见后发布 | 支持，仅自己可见后发布 | 不支持 |
| 知乎 | 预留 | 不支持 | 计划中 |
| B站 | 计划中 | 计划中 | 不支持 |
| CSDN | 预留 | 不支持 | 计划中 |
| 微信公众号 | 预留 | 不支持 | 计划中 |

后续平台通过 adapter capability 扩展，避免改乱已经可用的小红书和抖音流程。

## 环境要求

- Node.js >= 20
- npm
- 可正常访问目标平台网页
- 首次运行需要安装 Playwright Chromium

本项目当前按 npm 方式部署和运行，不需要 Docker。

## 安装

```powershell
npm install
npm run install-browsers
```

如果 `playwright install chromium` 因网络失败，请先修复本机网络或代理后再重试。

## 启动 MCP Server

```powershell
npm run dev
```

MCP Server 通过 stdio 暴露工具能力。浏览器用户数据保存在 `.social-media-mcp/` 目录下，每个平台使用独立 profile。

需要复用登录态时，固定设置同一个 profile 后缀：

```powershell
$env:SOCIAL_MEDIA_MCP_PROFILE_SUFFIX='douyin-realtest'
```

## MCP Client 配置示例

把 `cwd` 改成你自己的项目目录：

```json
{
  "mcpServers": {
    "social-media-pubulish-mcp": {
      "command": "npm",
      "args": ["run", "dev"],
      "cwd": "D:/work/2026/code/social_media_skill"
    }
  }
}
```

## 工具说明

### `check_login_status`

检查平台是否已经登录。

```json
{
  "platform": "douyin"
}
```

支持平台：`xiaohongshu`、`douyin`。

### `open_login_page`

打开平台登录页或创作者中心页面。登录、扫码和验证码需要人工完成。

```json
{
  "platform": "douyin"
}
```

### `create_image_post_draft`

创建图文内容。小红书是草稿，抖音会在上传完成后选择“仅自己可见”并发布。

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

抖音图文示例：

```json
{
  "platform": "douyin",
  "title": "Prepared image post",
  "content": "Prepared body text.",
  "images": ["D:/absolute/path/cover.png"],
  "tags": ["douyin", "automation"]
}
```

输入规则：

- `title` 必须非空。
- `content` 必须非空。
- `images` 至少包含一个存在的本地图片路径。
- 支持图片格式：`.jpg`、`.jpeg`、`.png`、`.webp`。
- `tags` 可选，会转换为话题格式并填入内容。

抖音成功结果示例：

```json
{
  "platform": "douyin",
  "status": "published",
  "message": "Douyin image post was published with private visibility."
}
```

### `create_video_post_draft`

首版仅支持抖音视频。注意：为了适配抖音当前页面，视频流程不是保存草稿，而是在上传完成后选择“仅自己可见”并发布。

```json
{
  "platform": "douyin",
  "title": "Prepared video post",
  "content": "Prepared video description.",
  "video": "D:/absolute/path/video.mp4",
  "tags": ["douyin", "video"]
}
```

输入规则：

- `platform` 必须为 `douyin`。
- `title` 必须非空。
- `content` 必须非空。
- `video` 必须是存在的本地视频路径。
- 支持视频格式：`.mp4`、`.mov`、`.m4v`。
- 视频本身必须满足抖音上传要求，例如时长、格式、大小等。

成功结果示例：

```json
{
  "platform": "douyin",
  "status": "published",
  "message": "Douyin video post was published with private visibility."
}
```

## 登录和使用流程

1. 调用 `open_login_page` 打开对应平台页面。
2. 在可见浏览器窗口中手动登录。
3. 调用 `check_login_status` 检查登录状态。
4. 小红书图文调用 `create_image_post_draft` 创建草稿。
5. 抖音图文调用 `create_image_post_draft`，工具会上传图片、等待上传完成、选择“仅自己可见”并发布。
6. 抖音视频调用 `create_video_post_draft`，工具会上传视频、等待上传完成、选择“仅自己可见”并发布。

不要在同一个 profile 上同时启动多个浏览器自动化进程，否则可能出现 profile 锁定或登录态异常。

## Smoke 联调

### 小红书图文草稿

```powershell
$env:SOCIAL_MEDIA_MCP_PROFILE_SUFFIX='smoketest'
npm.cmd run smoke:xiaohongshu
```

### 抖音图文仅自己可见发布

推荐把中文标题、正文、标签写进 UTF-8 JSON 文件，再通过 `DOUYIN_SMOKE_INPUT_FILE` 传入，避免 `cmd` 批处理或错误编码把中文变成 `????`。

示例文件 `D:/work/2026/code/social_media_skill/.social-media-mcp/douyin-image-smoke.json`：

```json
{
  "title": "抖音图文自动化测试",
  "content": "这是一条用于验证抖音图文自动上传和发布流程的测试内容。",
  "tags": ["自动化测试", "抖音图文", "playwright"]
}
```

```powershell
$env:SOCIAL_MEDIA_MCP_PROFILE_SUFFIX='douyin-realtest'
$env:DOUYIN_LOGIN_POLL_INTERVAL_MS='30000'
$env:DOUYIN_SMOKE_MODE='image'
$env:DOUYIN_IMAGE_PATH='D:/absolute/path/cover.png'
$env:DOUYIN_SMOKE_INPUT_FILE='D:/work/2026/code/social_media_skill/.social-media-mcp/douyin-image-smoke.json'
npm.cmd run smoke:douyin
```

### 抖音视频仅自己可见发布

中文标题、正文、标签同样推荐走 UTF-8 JSON 文件：

示例文件 `D:/work/2026/code/social_media_skill/.social-media-mcp/douyin-video-smoke.json`：

```json
{
  "title": "抖音视频自动化测试",
  "content": "这是一条用于验证抖音视频上传完成识别和最终发布流程的测试内容。",
  "tags": ["自动化测试", "抖音视频", "playwright"]
}
```

```powershell
$env:SOCIAL_MEDIA_MCP_PROFILE_SUFFIX='douyin-realtest'
$env:SOCIAL_MEDIA_MCP_CLOSE_BROWSER_ON_EXIT='0'
$env:DOUYIN_LOGIN_POLL_INTERVAL_MS='30000'
$env:DOUYIN_VIDEO_UPLOAD_COMPLETE_TIMEOUT_MS='240000'
$env:DOUYIN_VIDEO_UPLOAD_SETTLE_MS='3000'
$env:DOUYIN_SMOKE_MODE='video'
$env:DOUYIN_VIDEO_PATH='D:/absolute/path/video.mp4'
$env:DOUYIN_SMOKE_INPUT_FILE='D:/work/2026/code/social_media_skill/.social-media-mcp/douyin-video-smoke.json'
npm.cmd run smoke:douyin
```

默认情况下，smoke 脚本会在未登录时打开登录页并轮询登录状态。

可选环境变量：

- `DOUYIN_AUTO_OPEN_LOGIN=0`：不自动打开抖音登录页。
- `DOUYIN_LOGIN_POLL_INTERVAL_MS=30000`：抖音登录页默认等待 30 秒后再检查一次登录状态。
- `DOUYIN_SMOKE_INPUT_FILE`：从 UTF-8 JSON 文件读取 `title`、`content`、`tags`，推荐用于中文内容。
- `XHS_AUTO_OPEN_LOGIN=0`：不自动打开小红书登录页。
- `SOCIAL_MEDIA_MCP_CLOSE_BROWSER_ON_EXIT=0`：脚本结束后保留浏览器窗口，方便观察页面。

## 抖音视频上传完成判定

抖音视频不能靠固定等待时间判断上传完成。当前流程按页面文字判断：

1. 先看到上传过程信号。
2. 再看到“预览视频”。
3. 同时不再看到上传过程信号。

上传过程信号包括：

- “上传过程中请不要删除/移动文件”
- “已上传”
- “当前速度”
- “剩余时间”
- “取消上传”
- “上传中”
- “正在上传”
- “处理中”
- “转码中”
- 百分比进度，例如 `8%`

只有满足完成条件后，才会继续填写内容、选择“仅自己可见”并点击最终发布按钮。

更详细的真实测试流程见：

- [skills/douyin-private-image-publish/SKILL.md](D:/work/2026/code/social_media_skill/skills/douyin-private-image-publish/SKILL.md:1)
- [skills/douyin-private-video-publish/SKILL.md](D:/work/2026/code/social_media_skill/skills/douyin-private-video-publish/SKILL.md:1)

## 开发验证

修改代码后至少运行：

```powershell
npm.cmd run typecheck
npm.cmd test
```

如果改动影响真实页面流程，再运行对应 smoke 命令。

## 安全边界

- 只使用正常浏览器自动化。
- 不保存用户名或密码。
- 不绕过验证码或平台验证。
- 不使用逆向得到的私有接口。
- 小红书图文默认只创建草稿。
- 抖音图文和抖音视频会发布，但都会先选择“仅自己可见”。

## 参考

本项目学习了 `flyerhzm/douyin-mcp` 这类项目中简单清晰的 Playwright + MCP 思路，也参考了多平台发布工具的产品方向，但不会复制 `xiaohongshu-mcp`、`douyin-mcp` 或 `Wechatsync` 的代码。
