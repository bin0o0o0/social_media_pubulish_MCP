---
name: xiaohongshu-draft-smoketest
description: Use when validating Xiaohongshu image-post drafting in this repository, especially when reusing an existing browser profile and avoiding repeated login during MCP or Playwright smoke tests.
---

# Xiaohongshu Draft Smoketest

## Overview

This skill records the working Xiaohongshu smoke-test flow for this repo.
Use one persistent Playwright profile, verify login first, then create a draft with a known-good local image.

## When to Use

- Xiaohongshu login already worked once and you want to reuse it
- `create_image_post_draft` needs a quick real-world check
- You want to avoid repeated QR login during debugging
- You are verifying regressions after touching [src/platforms/xiaohongshu.ts](D:/work/2026/code/life/social_media_skill/src/platforms/xiaohongshu.ts:1)

Do not use this as a general publishing workflow for other platforms.

## Workflow

1. Reuse the same `SOCIAL_MEDIA_MCP_PROFILE_SUFFIX` for every retry.
2. Run the smoke-test script instead of ad hoc inline shell snippets.
3. Let the script check login first.
4. If login is missing, let it open the Xiaohongshu creator page and wait for QR login.
5. After login, let it create one draft with the fixture image.
6. Let the script exit on its own; it closes its Playwright browser session during cleanup.

## Command

```bash
$env:SOCIAL_MEDIA_MCP_PROFILE_SUFFIX='smoketest6'
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
