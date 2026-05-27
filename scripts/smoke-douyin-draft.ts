import { closeBrowserSessions } from "../src/core/browser.js";
import { shouldCloseBrowserSessionsOnExit } from "../src/core/smoke.js";
import {
  handleCheckLoginStatus,
  handleCreateImagePostDraft,
  handleCreateVideoPostDraft,
  handleOpenLoginPage
} from "../src/tools/mcp.js";

const DEFAULT_IMAGE_PATH =
  "D:/work/2026/code/social_media_skill/.social-media-mcp/fixtures/test-image.png";
const DEFAULT_VIDEO_PATH =
  "D:/work/2026/code/social_media_skill/.social-media-mcp/fixtures/test-video.mp4";
const DEFAULT_TITLE = "douyin smoke draft";
const DEFAULT_CONTENT = "Smoke-test draft body for Douyin automation.";
const DEFAULT_TAGS = ["mcp", "douyin", "draft-test"];

async function main(): Promise<void> {
  const profileSuffix = process.env.SOCIAL_MEDIA_MCP_PROFILE_SUFFIX?.trim();
  const mode = parseMode(process.env.DOUYIN_SMOKE_MODE);
  const title = process.env.DOUYIN_TITLE?.trim() || DEFAULT_TITLE;
  const content = process.env.DOUYIN_CONTENT?.trim() || DEFAULT_CONTENT;
  const imagePath = process.env.DOUYIN_IMAGE_PATH?.trim() || DEFAULT_IMAGE_PATH;
  const videoPath = process.env.DOUYIN_VIDEO_PATH?.trim() || DEFAULT_VIDEO_PATH;
  const tags = parseTags(process.env.DOUYIN_TAGS);
  const autoOpenLogin = process.env.DOUYIN_AUTO_OPEN_LOGIN !== "0";
  const pollAttempts = Number.parseInt(process.env.DOUYIN_LOGIN_POLL_ATTEMPTS ?? "60", 10);

  console.log(
    JSON.stringify(
      {
        step: "start",
        platform: "douyin",
        mode,
        profileSuffix: profileSuffix || null,
        imagePath: mode === "image" ? imagePath : null,
        videoPath: mode === "video" ? videoPath : null,
        autoOpenLogin,
        pollAttempts
      },
      null,
      2
    )
  );

  let loginStatus = await checkLoginStatus();

  if (!loginStatus.loggedIn && autoOpenLogin) {
    console.log(JSON.stringify(await openLoginPage(), null, 2));
    loginStatus = await pollLoginStatus(pollAttempts);
  }

  console.log(JSON.stringify(loginStatus, null, 2));

  if (isProfileLocked(loginStatus)) {
    console.error(
      [
        "The Douyin profile is locked by another Google Chrome for Testing window.",
        "Close the existing testing window for the same SOCIAL_MEDIA_MCP_PROFILE_SUFFIX and rerun the script."
      ].join(" ")
    );
    process.exitCode = 3;
    return;
  }

  if (!loginStatus.loggedIn) {
    process.exitCode = 2;
    return;
  }

  const draftResult =
    mode === "video"
      ? await createVideoDraft({ title, content, videoPath, tags })
      : await createImageDraft({ title, content, imagePath, tags });
  console.log(JSON.stringify(draftResult, null, 2));

  process.exitCode = draftResult.status === "draft_created" || draftResult.status === "published" ? 0 : 1;
}

async function checkLoginStatus() {
  return parseToolResult(await handleCheckLoginStatus({ platform: "douyin" }));
}

async function openLoginPage() {
  return parseToolResult(await handleOpenLoginPage({ platform: "douyin" }));
}

async function createImageDraft(input: {
  title: string;
  content: string;
  imagePath: string;
  tags: string[];
}) {
  return parseToolResult(
    await handleCreateImagePostDraft({
      platform: "douyin",
      title: input.title,
      content: input.content,
      images: [input.imagePath],
      tags: input.tags
    })
  );
}

async function createVideoDraft(input: {
  title: string;
  content: string;
  videoPath: string;
  tags: string[];
}) {
  return parseToolResult(
    await handleCreateVideoPostDraft({
      platform: "douyin",
      title: input.title,
      content: input.content,
      video: input.videoPath,
      tags: input.tags
    })
  );
}

async function pollLoginStatus(attempts: number) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await sleep(5_000);
    const status = await checkLoginStatus();
    console.log(JSON.stringify({ step: "poll-login", attempt, status }, null, 2));

    if (status.loggedIn) {
      return status;
    }
  }

  return checkLoginStatus();
}

function parseToolResult(result: { content: Array<{ type: string; text?: string }> }) {
  const item = result.content[0];

  if (!item || item.type !== "text" || !item.text) {
    throw new Error("Expected text MCP content.");
  }

  return JSON.parse(item.text);
}

function parseTags(value: string | undefined): string[] {
  if (!value) {
    return DEFAULT_TAGS;
  }

  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseMode(value: string | undefined): "image" | "video" {
  return value === "video" ? "video" : "image";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProfileLocked(status: { message?: string }) {
  return (status.message || "").includes("existing browser session");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (shouldCloseBrowserSessionsOnExit()) {
      await closeBrowserSessions().catch(() => undefined);
    }
  });
