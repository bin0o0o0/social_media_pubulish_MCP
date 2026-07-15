---
name: xiaohongshu-draft-smoketest
description: Use when any coding agent needs to validate Xiaohongshu image-post drafting in this repository, especially when reusing an existing browser profile, avoiding repeated QR login, and running a real smoke test through the local Node or MCP workflow.
---

# Xiaohongshu Draft Smoketest

## Overview

This skill records the working Xiaohongshu smoke-test flow for this repo.
It is written for any agent or human operator that can run local shell commands, Node.js scripts, and Playwright-backed MCP code.
Use one persistent Playwright profile, verify login first, then create a draft with a known-good local image.

## When to Use

- Xiaohongshu login already worked once and you want to reuse it
- `create_image_post_draft` needs a quick real-world check
- You want to avoid repeated QR login during debugging
- You are verifying regressions after touching [src/platforms/xiaohongshu.ts](D:/work/2026/code/life/social_media_skill/src/platforms/xiaohongshu.ts:1)
- You are using Codex, Claude Code, Kimi, DeepSeek, or another agent that can execute the repo's local commands

Do not use this as a general publishing workflow for other platforms.

## Workflow

1. Reuse the same `SOCIAL_MEDIA_MCP_PROFILE_SUFFIX` for every retry.
2. Run the smoke-test script instead of ad hoc inline shell snippets.
3. Let the script check login first.
4. If login is missing, let it open the Xiaohongshu creator page and wait for QR login.
5. After login, let it create one draft with the fixture image.
6. Let the script exit on its own; by default it keeps the Playwright browser window open for inspection.
7. Only set `SOCIAL_MEDIA_MCP_CLOSE_BROWSER_ON_EXIT=1` when you explicitly want cleanup to close the browser.

## Command

PowerShell:

```bash
$env:SOCIAL_MEDIA_MCP_PROFILE_SUFFIX='smoketest6'
npx tsx scripts/smoke-xiaohongshu-draft.ts
```

Bash or zsh:

```bash
export SOCIAL_MEDIA_MCP_PROFILE_SUFFIX='smoketest6'
npx tsx scripts/smoke-xiaohongshu-draft.ts
```

Optional overrides:

```bash
$env:SOCIAL_MEDIA_MCP_PROFILE_SUFFIX='smoketest6'
$env:XHS_IMAGE_PATH='D:/absolute/path/to/image.png'
$env:XHS_TITLE='custom title'
$env:XHS_CONTENT='custom body'
$env:XHS_TAGS='mcp,automation,test'
npx tsx scripts/smoke-xiaohongshu-draft.ts
```

```bash
export SOCIAL_MEDIA_MCP_PROFILE_SUFFIX='smoketest6'
export XHS_IMAGE_PATH='D:/absolute/path/to/image.png'
export XHS_TITLE='custom title'
export XHS_CONTENT='custom body'
export XHS_TAGS='mcp,automation,test'
npx tsx scripts/smoke-xiaohongshu-draft.ts
```

## Agent Contract

Any agent using this skill should:

- stay inside this repository
- reuse the same `SOCIAL_MEDIA_MCP_PROFILE_SUFFIX` across retries
- prefer the smoke-test script over ad hoc one-off inline shell snippets
- avoid opening a second process against the same Playwright profile while one is still active
- treat the script's JSON output as the source of truth for success or failure

## Known Good Behavior

- Login check returns `loggedIn: true`
- Draft creation returns `status: "draft_created"`
- Xiaohongshu opens the image-draft route:
  `https://creator.xiaohongshu.com/publish/publish?from=menu&target=image`
- The adapter saves via the `xhs-publish-btn` component's `_onSave()` hook

## Common Mistakes

- Changing `SOCIAL_MEDIA_MCP_PROFILE_SUFFIX` between retries:
  that creates a fresh browser profile and forces login again.
- Leaving an old manual `Google Chrome for Testing` window open on the same profile:
  that can lock the profile for the next one-off probe.
- Using an image path with shell-encoding problems during inline experiments:
  prefer ASCII paths or set `XHS_IMAGE_PATH` explicitly.
- Probing with separate one-off processes against the same profile:
  that can trigger profile-lock errors or empty `about:blank` tabs.

## Files

- Skill: [skills/xiaohongshu-draft-smoketest/SKILL.md](D:/work/2026/code/life/social_media_skill/skills/xiaohongshu-draft-smoketest/SKILL.md:1)
- Script: [scripts/smoke-xiaohongshu-draft.ts](D:/work/2026/code/life/social_media_skill/scripts/smoke-xiaohongshu-draft.ts:1)
