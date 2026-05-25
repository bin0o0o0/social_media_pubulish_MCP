# social_media_pubulish_MCP

一个轻量级 MCP Server，用于把已经准备好的文字内容和本地图片自动填写到社交媒体平台，并创建图文草稿。

第一版支持：

- 小红书图文草稿
- 抖音图文草稿
- 用户手动网页登录
- 本地浏览器登录态持久化
- 草稿优先的浏览器自动化流程

第一版不负责生成内容、不绕过验证码、不逆向私有接口，也不会点击最终发布按钮。

## 安装

```bash
npm install
npm run install-browsers
```

## 运行

```bash
npm run dev
```

服务通过 stdio 暴露 MCP 能力。本地浏览器会话保存在 `.social-media-mcp/` 目录中，每个平台使用独立的用户数据目录。

## MCP Client 配置示例

```json
{
  "mcpServers": {
    "social-media-pubulish-mcp": {
      "command": "npm",
      "args": ["run", "dev"],
      "cwd": "D:/work/2026/code/life/social_media_skill"
    }
  }
}
```

## 工具

### `check_login_status`

```json
{
  "platform": "xiaohongshu"
}
```

支持的平台为 `xiaohongshu` 和 `douyin`。

### `open_login_page`

```json
{
  "platform": "douyin"
}
```

该工具会打开一个可见的 Chromium 浏览器窗口。请在浏览器中按平台正常流程手动登录。

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

输入规则：

- `title` 必须非空。
- `content` 必须非空。
- `images` 至少包含一个存在的本地图片路径。
- 支持的图片格式为 `.jpg`、`.jpeg`、`.png`、`.webp`。
- `tags` 可选，工具会在填写前统一转换成话题格式。

## 登录和使用流程

1. 调用 `open_login_page` 打开对应平台页面。
2. 在可见的 Chromium 浏览器窗口中完成手动登录。
3. 调用 `check_login_status` 检查登录状态。
4. 使用已经准备好的标题、正文和图片路径调用 `create_image_post_draft`。

## 安全和合规边界

- 工具只使用正常的可见浏览器自动化。
- 工具不会保存用户名或密码。
- 工具不会绕过验证码或平台验证。
- 工具不会使用逆向得到的私有接口。
- 工具默认只创建草稿，不点击最终发布按钮。

## 项目说明

本项目学习了 `flyerhzm/douyin-mcp` 这类项目中简单清晰的 Playwright + MCP 思路，也参考了多平台发布工具的产品方向，但不会复制 `xiaohongshu-mcp`、`douyin-mcp` 或 `Wechatsync` 的代码。

## 小红书联调复用

已经沉淀了一套可复用的小红书图文草稿联调 skill 和脚本：

- Skill: `skills/xiaohongshu-draft-smoketest/SKILL.md`
- Script: `npm run smoke:xiaohongshu`

复用已有登录态时，保持同一个 `SOCIAL_MEDIA_MCP_PROFILE_SUFFIX` 即可，避免重复扫码登录。
