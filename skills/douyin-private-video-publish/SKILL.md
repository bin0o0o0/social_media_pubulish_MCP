---
name: douyin-private-video-publish
description: Use when an AI coding agent needs to validate or repair the Douyin video upload workflow in this repository: wait for real upload completion, select private visibility, then publish. Applies to Codex, Claude, Kimi, DeepSeek, and other agents that can edit code and run local npm commands.
---

# 抖音视频私密发布真实测试

## 目标

这个 skill 记录本仓库中已经验证成功的抖音视频自动化流程。

目标不是保存草稿，而是：

1. 打开抖音创作者中心视频上传页。
2. 上传本地视频文件。
3. 等待视频真正上传完成。
4. 填写标题、正文和话题标签。
5. 选择“仅自己可见”。
6. 点击“发布”或“立即发布”。

适用于 Codex、Claude、Kimi、DeepSeek 等可以阅读代码、修改代码、运行 npm 命令的大模型代理。

## 核心约束

- 不要用 Docker。本仓库此流程按用户要求使用 npm。
- 中文标题、正文、标签不要通过 ASCII `cmd` 批处理文件注入环境变量。
- 优先使用 `DOUYIN_SMOKE_INPUT_FILE` 指向 UTF-8 JSON 文件。
- 不要把“发布设置”“重新上传”“添加音乐”单独当成上传完成。
- 不要用固定等待 10 分钟代替页面状态判断。
- 不要在视频还显示“上传过程中请不要删除/移动文件”时点击发布。
- 不要点击左侧“高清发布”“发布视频”“发布图文”等入口按钮来冒充最终发布按钮。
- 最终发布前必须先选择“仅自己可见”。
- 重试时复用同一个 `SOCIAL_MEDIA_MCP_PROFILE_SUFFIX`；不要删除 `.social-media-mcp/`，否则会丢登录态。
- 不要重复手动启动 `npm run dev`；需要排查重复进程时先运行 `npm run mcp:processes`。

## 上传完成判定

视频上传完成必须满足以下条件：

- 已经看见过上传过程信号。
- 当前看见“预览视频”。
- 当前看不见上传过程信号。

上传过程信号包括：

- “上传过程中请不要删除/移动文件”
- “已上传”
- “当前速度”
- “剩余时间”
- “取消上传”
- “上传中”
- “正在上传”
- “处理中”
- “正在处理”
- “转码中”
- “校验中”
- “检测中”
- 进度百分比，例如 `8%`

失败信号包括：

- “上传失败”
- “视频不符合”
- “格式不支持”
- “文件损坏”

模型无关伪代码：

```text
sawUploadProgress = false

while not timeout:
  if page contains any failure signal:
    fail

  inProgress = page contains any upload-progress signal
  complete = page contains "预览视频"

  if inProgress:
    sawUploadProgress = true

  if sawUploadProgress and complete and not inProgress:
    wait a short settle delay
    upload is complete

  wait briefly and retry
```

## 发布流程

上传完成后按这个顺序执行：

1. 填标题。
2. 填正文，并把标签格式化成 `#tag` 追加到正文或话题输入区。
3. 滚动到页面底部或发布设置区域。
4. 点击“仅自己可见”。
5. 如果“仅自己可见”没有直接出现，先展开“谁可以看”“公开”或“可见范围”，再点击“仅自己可见”。
6. 点击最终发布按钮。

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

先准备一个 UTF-8 JSON 文件，例如 `D:/work/2026/code/social_media_skill/.social-media-mcp/douyin-video-smoke.json`：

```json
{
  "title": "抖音视频自动化测试",
  "content": "这是一条用于验证抖音视频上传完成识别和最终发布流程的测试内容。",
  "tags": ["自动化测试", "抖音视频", "playwright"]
}
```

PowerShell 示例：

```powershell
$env:SOCIAL_MEDIA_MCP_PROFILE_SUFFIX='douyin-realtest'
$env:SOCIAL_MEDIA_MCP_CLOSE_BROWSER_ON_EXIT='0'
$env:DOUYIN_LOGIN_POLL_INTERVAL_MS='30000'
$env:DOUYIN_VIDEO_UPLOAD_COMPLETE_TIMEOUT_MS='240000'
$env:DOUYIN_VIDEO_UPLOAD_SETTLE_MS='3000'
$env:DOUYIN_SMOKE_MODE='video'
$env:DOUYIN_VIDEO_PATH='C:\Users\Administrator\Videos\NVIDIA\League of Legends\League of Legends 2025.11.10 - 20.27.22.01.mp4'
$env:DOUYIN_SMOKE_INPUT_FILE='D:/work/2026/code/social_media_skill/.social-media-mcp/douyin-video-smoke.json'
npm.cmd run smoke:douyin
```

如果同一个 profile 已有活跃 smoke session，`smoke:douyin`/`smoke:douyin:start` 会返回已有 `sessionId`，继续 watch/status 即可，不要另起一个并发流程抢同一个浏览器 profile。

成功时 JSON 结果应包含：

```json
{
  "platform": "douyin",
  "status": "published",
  "message": "Douyin video post was published with private visibility."
}
```

## 维护代码时要检查的文件

- `src/platforms/douyin.ts`
- `src/platforms/types.ts`
- `scripts/smoke-douyin-draft.ts`
- `tests/tools/mcp.test.ts`

## 回归验证

每次修改后至少运行：

```powershell
npm.cmd run typecheck
npm.cmd test
```

如果改动影响真实页面流程，再用上面的 smoke 命令跑一次。真实测试会发布视频，所以必须确认流程会先选择“仅自己可见”。
