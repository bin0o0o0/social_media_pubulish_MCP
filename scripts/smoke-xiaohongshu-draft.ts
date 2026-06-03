import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { callJsonTool, createLocalMcpClient } from "../src/core/local-mcp-client.js";
import { shouldCloseBrowserSessionsOnExit } from "../src/core/smoke.js";

const DEFAULT_IMAGE_PATH =
  "D:/work/2026/code/life/social_media_skill/.social-media-mcp/fixtures/test-image.png";
const DEFAULT_TITLE = "xiaohongshu smoke draft";
const DEFAULT_CONTENT = "Smoke-test draft body for Xiaohongshu image post automation.";
const DEFAULT_TAGS = ["mcp", "xiaohongshu", "draft-test"];

type LoginStatusResult = {
  platform: "xiaohongshu";
  loggedIn: boolean;
  message: string;
};

type DraftResult = {
  platform: "xiaohongshu";
  status: "draft_created" | "login_required" | "failed";
  message: string;
};

async function main(): Promise<void> {
  const closeBrowserOnExit = shouldCloseBrowserSessionsOnExit();
  const profileSuffix = process.env.SOCIAL_MEDIA_MCP_PROFILE_SUFFIX?.trim();
  const imagePaths = parseImagePaths(process.env.XHS_IMAGE_PATH) || [DEFAULT_IMAGE_PATH];
  const title = process.env.XHS_TITLE?.trim() || DEFAULT_TITLE;
  const content = process.env.XHS_CONTENT?.trim() || DEFAULT_CONTENT;
  const tags = parseTags(process.env.XHS_TAGS);
  const autoOpenLogin = process.env.XHS_AUTO_OPEN_LOGIN !== "0";
  const pollAttempts = Number.parseInt(process.env.XHS_LOGIN_POLL_ATTEMPTS ?? "60", 10);
  const waitForEnterOnExit =
    process.env.XHS_WAIT_FOR_ENTER_ON_EXIT === "1" ||
    (!closeBrowserOnExit && process.stdin.isTTY && process.env.CI !== "true");

  console.log(
    JSON.stringify(
      {
        step: "start",
        platform: "xiaohongshu",
        profileSuffix: profileSuffix || null,
        imagePaths,
        autoOpenLogin,
        pollAttempts,
        closeBrowserOnExit,
        waitForEnterOnExit
      },
      null,
      2
    )
  );

  const session = await createLocalMcpClient();

  try {
    let loginStatus = await checkLoginStatus(session.client);

    if (!loginStatus.loggedIn && autoOpenLogin) {
      console.log(JSON.stringify(await openLoginPage(session.client), null, 2));
      loginStatus = await pollLoginStatus(session.client, pollAttempts);
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

    const draftResult = await createDraft(session.client, { title, content, imagePath, tags });
    console.log(JSON.stringify(draftResult, null, 2));

    process.exitCode = draftResult.status === "draft_created" ? 0 : 1;

    if (waitForEnterOnExit) {
      await waitForExitConfirmation();
    }
  } finally {
    await session.close().catch(() => undefined);
  }
}

async function checkLoginStatus(client: Awaited<ReturnType<typeof createLocalMcpClient>>["client"]) {
  return callJsonTool<LoginStatusResult>(client, "check_login_status", { platform: "xiaohongshu" });
}

async function openLoginPage(client: Awaited<ReturnType<typeof createLocalMcpClient>>["client"]) {
  return callJsonTool<Record<string, unknown>>(client, "open_login_page", { platform: "xiaohongshu" });
}

async function createDraft(
  client: Awaited<ReturnType<typeof createLocalMcpClient>>["client"],
  inputArgs: {
    title: string;
    content: string;
    imagePath: string;
    tags: string[];
  }
) {
  return callJsonTool<DraftResult>(client, "create_image_post_draft", {
    platform: "xiaohongshu",
    title: inputArgs.title,
    content: inputArgs.content,
    images: [inputArgs.imagePath],
    tags: inputArgs.tags
  });
}

async function pollLoginStatus(client: Awaited<ReturnType<typeof createLocalMcpClient>>["client"], attempts: number) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await sleep(5_000);
    const status = await checkLoginStatus(client);
    console.log(JSON.stringify({ step: "poll-login", attempt, status }, null, 2));

    if (status.loggedIn) {
      return status;
    }
  }

  return checkLoginStatus(client);
}

async function waitForExitConfirmation(): Promise<void> {
  if (!process.stdin.isTTY) {
    return;
  }

  const rl = createInterface({ input, output });
  try {
    await rl.question("Press Enter to close the local MCP smoke session...");
  } finally {
    rl.close();
  }
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

function parseImagePaths(value: string | undefined): string[] | null {
  if (!value?.trim()) {
    return null;
  }
  const paths = value
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return paths.length > 0 ? paths : null;
}

function isProfileLocked(status: { message?: string }) {
  return (status.message || "").includes("existing browser session");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
