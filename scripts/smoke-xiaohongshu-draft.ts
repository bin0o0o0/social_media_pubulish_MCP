import { closeBrowserSessions } from "../src/core/browser.js";
import {
  handleCheckLoginStatus,
  handleCreateImagePostDraft,
  handleOpenLoginPage
} from "../src/tools/mcp.js";

const DEFAULT_IMAGE_PATH =
  "D:/work/2026/code/life/social_media_skill/.social-media-mcp/fixtures/test-image.png";
const DEFAULT_TITLE = "xiaohongshu smoke draft";
const DEFAULT_CONTENT = "Smoke-test draft body for Xiaohongshu image post automation.";
const DEFAULT_TAGS = ["mcp", "xiaohongshu", "draft-test"];

async function main(): Promise<void> {
  const profileSuffix = process.env.SOCIAL_MEDIA_MCP_PROFILE_SUFFIX?.trim();
  const imagePath = process.env.XHS_IMAGE_PATH?.trim() || DEFAULT_IMAGE_PATH;
  const title = process.env.XHS_TITLE?.trim() || DEFAULT_TITLE;
  const content = process.env.XHS_CONTENT?.trim() || DEFAULT_CONTENT;
  const tags = parseTags(process.env.XHS_TAGS);
  const autoOpenLogin = process.env.XHS_AUTO_OPEN_LOGIN !== "0";
  const pollAttempts = Number.parseInt(process.env.XHS_LOGIN_POLL_ATTEMPTS ?? "60", 10);

  console.log(
    JSON.stringify(
      {
        step: "start",
        platform: "xiaohongshu",
        profileSuffix: profileSuffix || null,
        imagePath,
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
        "The Xiaohongshu profile is locked by another Google Chrome for Testing window.",
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

  const draftResult = await createDraft({ title, content, imagePath, tags });
  console.log(JSON.stringify(draftResult, null, 2));

  process.exitCode = draftResult.status === "draft_created" ? 0 : 1;
}

async function checkLoginStatus() {
  return parseToolResult(await handleCheckLoginStatus({ platform: "xiaohongshu" }));
}

async function openLoginPage() {
  return parseToolResult(await handleOpenLoginPage({ platform: "xiaohongshu" }));
}

async function createDraft(input: {
  title: string;
  content: string;
  imagePath: string;
  tags: string[];
}) {
  return parseToolResult(
    await handleCreateImagePostDraft({
      platform: "xiaohongshu",
      title: input.title,
      content: input.content,
      images: [input.imagePath],
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
    await closeBrowserSessions().catch(() => undefined);
  });
