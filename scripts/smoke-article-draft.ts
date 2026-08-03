import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { callJsonTool, createLocalMcpClient } from "../src/core/local-mcp-client.js";
import type { ArticlePostPlatform } from "../src/core/schemas.js";
import { shouldCloseBrowserSessionsOnExit } from "../src/core/smoke.js";

type LoginStatusResult = {
  platform: ArticlePostPlatform;
  loggedIn: boolean;
  message: string;
};

type DraftResult = {
  platform: ArticlePostPlatform;
  status: "draft_created" | "login_required" | "failed";
  message: string;
  warnings?: string[];
};

async function main(): Promise<void> {
  const platform = parsePlatform(process.argv[2]);
  const markdownPath = requiredEnv("ARTICLE_MD_PATH");
  const title = requiredEnv("ARTICLE_TITLE");
  const coverImage = optionalEnv("ARTICLE_COVER_IMAGE");
  const tags = parseList(process.env.ARTICLE_TAGS);
  const category = optionalEnv("ARTICLE_CATEGORY");
  const autoOpenLogin = process.env.ARTICLE_AUTO_OPEN_LOGIN !== "0";
  const pollAttempts = Number.parseInt(process.env.ARTICLE_LOGIN_POLL_ATTEMPTS ?? "20", 10);
  const pollIntervalMs = Number.parseInt(process.env.ARTICLE_LOGIN_POLL_INTERVAL_MS ?? "30000", 10);
  const toolTimeoutMs = Number.parseInt(process.env.ARTICLE_TOOL_TIMEOUT_MS ?? "180000", 10);
  const closeBrowserOnExit = shouldCloseBrowserSessionsOnExit();
  const waitForEnterOnExit =
    process.env.ARTICLE_WAIT_FOR_ENTER_ON_EXIT === "1" ||
    (!closeBrowserOnExit && process.stdin.isTTY && process.env.CI !== "true");

  console.log(
    JSON.stringify(
      {
        step: "start",
        platform,
        markdownPath,
        title,
        coverImage: coverImage || null,
        tags,
        category: category || null,
        pollAttempts,
        pollIntervalMs,
        profileSuffix: process.env.SOCIAL_MEDIA_MCP_PROFILE_SUFFIX?.trim() || null
      },
      null,
      2
    )
  );

  const session = await createLocalMcpClient();
  try {
    let login = await callJsonTool<LoginStatusResult>(session.client, "check_login_status", { platform });

    if (!login.loggedIn && autoOpenLogin) {
      console.log(
        JSON.stringify(await callJsonTool(session.client, "open_login_page", { platform }), null, 2)
      );
      login = await pollLogin(session.client, platform, pollAttempts, pollIntervalMs);
    }

    console.log(JSON.stringify(login, null, 2));
    if (!login.loggedIn) {
      process.exitCode = 2;
      return;
    }

    const draft = await callJsonTool<DraftResult>(
      session.client,
      "create_article_post_draft",
      {
        platform,
        title,
        markdownPath,
        ...(coverImage ? { coverImage } : {}),
        ...(tags.length ? { tags } : {}),
        ...(category ? { category } : {})
      },
      toolTimeoutMs
    );
    console.log(JSON.stringify(draft, null, 2));
    process.exitCode = draft.status === "draft_created" ? 0 : 1;

    if (waitForEnterOnExit) {
      await waitForExitConfirmation();
    }
  } finally {
    await session.close().catch(() => undefined);
  }
}

async function pollLogin(
  client: Awaited<ReturnType<typeof createLocalMcpClient>>["client"],
  platform: ArticlePostPlatform,
  attempts: number,
  intervalMs: number
): Promise<LoginStatusResult> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const status = await callJsonTool<LoginStatusResult>(client, "check_login_status", { platform });
    console.log(JSON.stringify({ step: "poll-login", attempt, status }, null, 2));
    if (status.loggedIn) {
      return status;
    }
  }

  return callJsonTool<LoginStatusResult>(client, "check_login_status", { platform });
}

function parsePlatform(value: string | undefined): ArticlePostPlatform {
  if (value === "csdn" || value === "zhihu" || value === "wechat") {
    return value;
  }
  throw new Error("article smoke platform must be one of: csdn, zhihu, wechat");
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function parseList(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function waitForExitConfirmation(): Promise<void> {
  const rl = createInterface({ input, output });
  try {
    await rl.question("Press Enter to close the local MCP smoke session...");
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
