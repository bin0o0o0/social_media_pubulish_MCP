---
name: douyin-verification-workflow
description: Use when any coding agent needs to run or continue the Douyin image-post smoke workflow in this repository, especially when a local long-lived smoke session may enter SMS verification and must pause for a human-provided code before resuming.
---

# 抖音验证码续提交流程

## 概览

这份 skill 记录了本仓库里已经验证通过的抖音图文 smoke 流程。
它面向任何能在本地执行命令、运行 Node.js、调用 Playwright/MCP 的 agent，包括 Codex、Claude、Kimi、DeepSeek。

它的重点不是“如何发布任意内容”，而是：

- 复用已有抖音登录态
- 用本地常驻 smoke session 跑图文发布
- 当抖音弹出短信验证码时，不要丢失浏览器上下文
- 等待用户提供验证码后，再继续填码并点击 `验证`

## 何时使用

- 你要验证本仓库的抖音图文自动发布流程
- 你需要在同一个本地浏览器会话里跨过“短信验证码”这个中断点
- 你不想因为一次性脚本结束而丢失验证码弹窗上下文
- 你正在修改这些文件后做真实回归：
  - [src/platforms/douyin.ts](D:/work/2026/code/life/social_media_skill/src/platforms/douyin.ts:1)
  - [src/core/douyin-smoke-controller.ts](D:/work/2026/code/life/social_media_skill/src/core/douyin-smoke-controller.ts:1)
  - [scripts/smoke-douyin-draft.ts](D:/work/2026/code/life/social_media_skill/scripts/smoke-douyin-draft.ts:1)

不要把这份 skill 当成别的平台通用发布说明书。它当前只覆盖：

- 抖音图文
- 本地常驻 smoke session
- 短信验证码续提交

## 核心规则

任何 agent 使用这份 skill 时都应该遵守：

- 默认使用中文和用户沟通
- 默认复用同一个 `SOCIAL_MEDIA_MCP_PROFILE_SUFFIX`
- 不要在拿到验证码前关闭浏览器
- 不要擅自结束 smoke session
- 一旦状态进入 `awaiting_verification`，必须明确告诉用户“短信验证码已发送”
- 必须等待用户提供验证码后，再执行 `submit`
- 成功状态应为 `completed`
- 如果本次没有触发验证码，就直接以成功完成为准，不要强行进入验证码流程

## 标准流程

### 1. 启动会话

PowerShell：

```powershell
$env:SOCIAL_MEDIA_MCP_PROFILE_SUFFIX='douyin-live3'
$env:DOUYIN_AUTO_OPEN_LOGIN='0'
$env:DOUYIN_IMAGE_PATHS='C:\img1.png|C:\img2.png|C:\img3.png'
npm run smoke:douyin:start
```

要点：

- `SOCIAL_MEDIA_MCP_PROFILE_SUFFIX` 要在重试时保持一致
- `DOUYIN_IMAGE_PATHS` 用 `|` 分隔多图路径
- `DOUYIN_AUTO_OPEN_LOGIN='0'` 表示这次依赖已有登录态

启动后会创建一个新的 `sessionId`。

### 2. 立刻进入 watch

```powershell
npm run smoke:douyin:watch -- <session-id>
```

这个命令的作用是尽快把状态推进到以下三种之一：

- `awaiting_verification`
- `completed`
- `failed`

默认每 1 秒检查一次状态。

### 3. 分支处理

#### 情况 A：状态是 `awaiting_verification`

说明：

- 抖音短信验证码已经触发发送
- 本地后台 worker 还活着
- 浏览器验证码弹窗还在

这时 agent 必须：

1. 明确告诉用户验证码已发送
2. 等待用户提供验证码
3. 拿到验证码后执行：

```powershell
npm run smoke:douyin:submit -- <session-id> <code>
```

4. 然后再次查看状态：

```powershell
npm run smoke:douyin:status -- <session-id>
```

成功时应看到：

```txt
status: completed
lastResult.status: verified
```

#### 情况 B：状态是 `completed`

说明这次没有触发验证码，或者验证码已经走完。

这时 agent 应直接告诉用户：

- 本次图文发布成功
- 本次没有进入验证码续提交流程，或者流程已经完成

#### 情况 C：状态是 `failed`

这时 agent 不要直接猜原因。
要先看：

```powershell
npm run smoke:douyin:status -- <session-id>
```

重点检查：

- `message`
- `lastResult`
- `workerPid`

然后再决定下一步。

### 4. 如需停止会话

```powershell
npm run smoke:douyin:stop -- <session-id>
```

默认不要太早 stop。
尤其是在：

- 还没收到验证码前
- 用户还没确认页面结果前

## 关键命令速查

```powershell
npm run smoke:douyin:start
npm run smoke:douyin:watch -- <session-id>
npm run smoke:douyin:status -- <session-id>
npm run smoke:douyin:submit -- <session-id> <code>
npm run smoke:douyin:stop -- <session-id>
```

## 成功标准

一次成功的抖音图文 smoke 至少满足下面之一：

### 无验证码成功

- `watch` 最终返回 `completed`
- `lastResult.status` 是 `draft_created`

### 有验证码成功

- `watch` 先返回 `awaiting_verification`
- 用户提供验证码后执行 `submit`
- 再查 `status`
- 最终变成 `completed`
- `lastResult.status` 是 `verified`

## 对 agent 的约束

任何 agent 使用这份 skill 时，不要做这些事：

- 不要在 `awaiting_verification` 时直接结束会话
- 不要要求用户重新扫码，除非登录态确实失效
- 不要在还没拿到验证码时提前关闭浏览器
- 不要创建第二个并发进程去抢同一个 profile
- 不要把 session id 和 profile suffix 混为一谈

## session id 是什么

`sessionId` 是一次本地 smoke 会话的唯一编号。

它不是：

- 抖音账号 id
- 浏览器 profile 名
- 抖音作品 id

它只是这次本地后台 worker 和状态文件的“任务号”。

## 原理

这套流程不是靠聊天上下文“记住”验证码流程，而是靠三件事：

1. 一个活着的后台 worker
2. 一个活着的 MCP/browser 会话
3. 一个本地 session 状态文件

当抖音要求短信验证码时，后台 worker 不退出，而是把状态写成：

```txt
awaiting_verification
```

之后另一个命令再把验证码写回同一个 session，worker 才继续执行 `submit_verification_code`。

## 隐私边界

这份 skill 本身不引入新的远端风险，但它依赖的本地控制器会保存一些本地状态：

- 浏览器登录态保存在 `.social-media-mcp/`
- session 状态文件保存在 `.social-media-mcp/douyin-smoke-sessions/`
- 验证码会短暂写入本地 session JSON，供后台 worker 继续提交

它不会：

- 保存账号密码
- 上传验证码到云端
- 逆向私有接口

如果要降低风险：

- 不要把 `.social-media-mcp/` 提交到 git
- 联调完成后删除不需要的 session 文件
- 不要在多人共用机器上长期保留创作者后台登录态

## 相关文件

- Skill：
  [skills/douyin-verification-workflow/SKILL.md](D:/work/2026/code/life/social_media_skill/skills/douyin-verification-workflow/SKILL.md:1)
- 控制器：
  [src/core/douyin-smoke-controller.ts](D:/work/2026/code/life/social_media_skill/src/core/douyin-smoke-controller.ts:1)
- 会话状态：
  [src/core/douyin-smoke-session.ts](D:/work/2026/code/life/social_media_skill/src/core/douyin-smoke-session.ts:1)
- 命令入口：
  [scripts/smoke-douyin-draft.ts](D:/work/2026/code/life/social_media_skill/scripts/smoke-douyin-draft.ts:1)
- 平台实现：
  [src/platforms/douyin.ts](D:/work/2026/code/life/social_media_skill/src/platforms/douyin.ts:1)
