---
name: douyin-private-image-publish
description: Use when an AI coding agent needs to validate or repair the Douyin image-post workflow in this repository: wait for image upload readiness, fill metadata from UTF-8 input, select private visibility, then publish. Applies to Codex, Claude, Kimi, DeepSeek, and other agents that can edit code and run local npm commands.
---

# 抖音图文私密发布真实测试

## 目标

这个 skill 记录本仓库中已经验证成功的抖音图文自动化流程。

目标不是保存草稿，而是：

1. 打开抖音创作者中心图文上传页。
2. 上传本地图片文件。
3. 等待图片上传完成并进入编辑态。
4. 填写标题、正文和话题标签。
5. 选择“仅自己可见”。
6. 点击“发布”。

适用于 Codex、Claude、Kimi、DeepSeek 等可以阅读代码、修改代码、运行 npm 命令的大模型代理。

## 核心约束

- 不要用 Docker。本仓库此流程按用户要求使用 npm。
- 中文标题、正文、标签不要通过 ASCII `cmd` 批处理文件注入环境变量。
- 优先使用 `DOUYIN_SMOKE_INPUT_FILE` 指向 UTF-8 JSON 文件。
- 登录页打开后默认给 30 秒时间，不要 5 秒就刷新。
- 不要把“保存草稿”“暂存”“高清发布”“发布视频”“发布图文”误当成最终发布按钮。
- 最终发布前必须先选择“仅自己可见”。
- 重试时复用同一个 `SOCIAL_MEDIA_MCP_PROFILE_SUFFIX`；不要删除 `.social-media-mcp/`，否则会丢登录态。
- 不要重复手动启动 `npm run dev`；需要排查重复进程时先运行 `npm run mcp:processes`。

## 图文流程

图文发布按这个顺序执行：

1. 进入抖音图文发布入口。
2. 上传本地图片。
3. 等到标题/正文编辑区可见，确认页面已进入编辑态。
4. 填标题。
5. 填正文，并把标签格式化成 `#tag`。
6. 滚动到页面底部或发布设置区域。
7. 点击“仅自己可见”。
8. 点击最终“发布”或“立即发布”按钮。

最终发布按钮必须精确匹配：

- “发布”
- “立即发布”

不要点击这些按钮或入口：

- “高清发布”
- “发布视频”
- “发布图文”
- “保存草稿”
- “暂存”
- “预览”

## npm 真实测试命令

先准备一个 UTF-8 JSON 文件，例如 `D:/work/2026/code/social_media_skill/.social-media-mcp/douyin-image-smoke.json`：

```json
{
  "title": "抖音图文自动化测试",
  "content": "这是一条用于验证抖音图文自动上传、中文输入和最终发布流程的测试内容。",
  "tags": ["自动化测试", "抖音图文", "playwright"]
}
```

PowerShell 示例：

```powershell
$env:SOCIAL_MEDIA_MCP_PROFILE_SUFFIX='douyin-realtest'
$env:DOUYIN_LOGIN_POLL_INTERVAL_MS='30000'
$env:DOUYIN_SMOKE_MODE='image'
$env:DOUYIN_IMAGE_PATH='C:\Users\Administrator\Pictures\Saved Pictures\v2-d70a934f16880fcadcaebb4865db4860_r.jpg'
$env:DOUYIN_SMOKE_INPUT_FILE='D:/work/2026/code/social_media_skill/.social-media-mcp/douyin-image-smoke.json'
npm.cmd run smoke:douyin
```

如果同一个 profile 已有活跃 smoke session，`smoke:douyin`/`smoke:douyin:start` 会返回已有 `sessionId`，继续 watch/status 即可，不要另起一个并发流程抢同一个浏览器 profile。

成功时 JSON 结果应包含：

```json
{
  "platform": "douyin",
  "status": "published",
  "message": "Douyin image post was published with private visibility."
}
```

## 维护代码时要检查的文件

- `src/platforms/douyin.ts`
- `scripts/smoke-douyin-draft.ts`
- `tests/tools/mcp.test.ts`
- `README.md`

## 回归验证

每次修改后至少运行：

```powershell
npm.cmd run typecheck
npm.cmd test
```

如果改动影响真实页面流程，再用上面的 smoke 命令跑一次。
