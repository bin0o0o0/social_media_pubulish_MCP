# social_media_pubulish_MCP

一个轻量级 MCP Server，用 Playwright 把已经准备好的文字、图片或视频自动填写到社交媒体创作者后台，并创建草稿。

本项目只做正常可见浏览器自动化，不生成内容、不绕过验证码、不逆向私有接口，默认不点击最终发布按钮。

## 平台能力

| 平台 | 图文草稿 | 视频草稿 | 文章草稿 |
| --- | --- | --- | --- |
| 小红书 | 支持 | 不支持 | 不支持 |
| 抖音 | 支持 | 支持 | 不支持 |
| 知乎 | 预留 | 不支持 | 计划中 |
| B站 | 计划中 | 计划中 | 不支持 |
| CSDN | 预留 | 不支持 | 计划中 |
| 微信公众号 | 预留 | 不支持 | 计划中 |

后续平台通过 adapter capability 扩展，不需要改乱已经可用的小红书图文流程。

## 安装

```bash
npm install
npm run install-browsers
```

## 运行

```bash
npm run dev
```

服务通过 stdio 暴露 MCP 能力。浏览器会话保存在 `.social-media-mcp/`，每个平台使用独立用户数据目录。可以设置 `SOCIAL_MEDIA_MCP_PROFILE_SUFFIX` 复用同一套登录态。

## MCP Client 配置示例

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

## 工具

### `check_login_status`

```json
{
  "platform": "douyin"
}
```

支持的平台为 `xiaohongshu` 和 `douyin`。

### `open_login_page`

```json
{
  "platform": "douyin"
}
```

会打开一个可见 Chromium 窗口。请按平台正常流程手动扫码或登录。

### `create_image_post_draft`

```json
{
  "platform": "xiaohongshu",
  "title": "Prepared title",
  "content": "Prepared body text.",
  "images": ["D:/absolute/path/cover.png"],
  "tags": ["mcp", "automation"]
}
```

抖音图文草稿示例：

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
- 支持图片格式：`.jpg`, `.jpeg`, `.png`, `.webp`。
- `tags` 可选，工具会统一转换为话题格式并填入内容。

### `create_video_post_draft`

首版仅支持抖音：

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
- 支持视频格式：`.mp4`, `.mov`, `.m4v`。

## 登录和使用流程

1. 调用 `open_login_page` 打开对应平台创作者页面。
2. 在可见浏览器窗口中完成手动登录。
3. 调用 `check_login_status` 检查登录状态。
4. 调用 `create_image_post_draft` 或 `create_video_post_draft` 创建草稿。
5. 在平台页面人工检查草稿内容，再决定是否发布。

## Smoke 联调

小红书图文：

```bash
$env:SOCIAL_MEDIA_MCP_PROFILE_SUFFIX='smoketest'
npm run smoke:xiaohongshu
```

抖音图文：

```bash
$env:SOCIAL_MEDIA_MCP_PROFILE_SUFFIX='smoketest'
$env:DOUYIN_SMOKE_MODE='image'
$env:DOUYIN_IMAGE_PATH='D:/absolute/path/cover.png'
npm run smoke:douyin
```

抖音视频：

```bash
$env:SOCIAL_MEDIA_MCP_PROFILE_SUFFIX='smoketest'
$env:DOUYIN_SMOKE_MODE='video'
$env:DOUYIN_VIDEO_PATH='D:/absolute/path/video.mp4'
npm run smoke:douyin
```

默认情况下 smoke 脚本会在未登录时打开登录页并轮询登录状态。设置 `DOUYIN_AUTO_OPEN_LOGIN=0` 或 `XHS_AUTO_OPEN_LOGIN=0` 可关闭自动打开登录页。

## 安全边界

- 只使用正常浏览器自动化。
- 不保存用户名或密码。
- 不绕过验证码或平台验证。
- 不使用逆向得到的私有接口。
- 默认只创建草稿，不点击最终发布按钮。

## 参考

本项目学习了 `flyerhzm/douyin-mcp` 这类项目中简单清晰的 Playwright + MCP 思路，也参考了多平台发布工具的产品方向，但不会复制 `xiaohongshu-mcp`、`douyin-mcp` 或 `Wechatsync` 的代码。
