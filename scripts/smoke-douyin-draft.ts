import { readFileSync } from "node:fs";
import process from "node:process";
import {
  getDouyinSmokeSessionStatus,
  runDouyinSmokeWorker,
  startDouyinSmokeSession,
  stopDouyinSmokeSession,
  submitDouyinSmokeSessionCode
} from "../src/core/douyin-smoke-controller.js";

const DEFAULT_IMAGE_PATH =
  "D:/work/2026/code/life/social_media_skill/.social-media-mcp/fixtures/test-image.png";
const DEFAULT_VIDEO_PATH =
  "D:/work/2026/code/life/social_media_skill/.social-media-mcp/fixtures/test-video.mp4";
const DEFAULT_TITLE = "douyin smoke draft";
const DEFAULT_CONTENT = "Smoke-test draft body for Douyin automation.";
const DEFAULT_TAGS = ["mcp", "douyin", "draft-test"];

type SmokeInputFile = {
  title?: string;
  content?: string;
  tags?: string[] | string;
};

async function main(): Promise<void> {
  const command = process.argv[2] ?? "start";
  const workspaceRoot = process.cwd();

  switch (command) {
    case "start": {
      const mode = parseMode(process.env.DOUYIN_SMOKE_MODE);
      const inputFile = readSmokeInputFile(process.env.DOUYIN_SMOKE_INPUT_FILE);
      const record = startDouyinSmokeSession({
        workspaceRoot,
        profileSuffix: process.env.SOCIAL_MEDIA_MCP_PROFILE_SUFFIX?.trim() || null,
        mode,
        draftInput: {
          title: resolveSmokeText(process.env.DOUYIN_TITLE, inputFile?.title) || DEFAULT_TITLE,
          content: resolveSmokeText(process.env.DOUYIN_CONTENT, inputFile?.content) || DEFAULT_CONTENT,
          imagePaths: parseImagePaths(process.env.DOUYIN_IMAGE_PATHS, process.env.DOUYIN_IMAGE_PATH),
          videoPath: mode === "video" ? process.env.DOUYIN_VIDEO_PATH?.trim() || DEFAULT_VIDEO_PATH : null,
          coverImagePath: mode === "video" ? process.env.DOUYIN_VIDEO_COVER_PATH?.trim() || null : null,
          coverOrientation: parseCoverOrientation(process.env.DOUYIN_VIDEO_COVER_ORIENTATION),
          tags: resolveSmokeTags(process.env.DOUYIN_TAGS, inputFile?.tags)
        },
        settings: {
          autoOpenLogin: process.env.DOUYIN_AUTO_OPEN_LOGIN !== "0",
          pollAttempts: Number.parseInt(process.env.DOUYIN_LOGIN_POLL_ATTEMPTS ?? "60", 10),
          loginInitialWaitMs: Number.parseInt(process.env.DOUYIN_LOGIN_INITIAL_WAIT_MS ?? "0", 10)
        }
      });
      console.log(JSON.stringify(record, null, 2));
      return;
    }
    case "status": {
      const sessionId = requireSessionId(process.argv[3]);
      const record = getDouyinSmokeSessionStatus(workspaceRoot, sessionId);
      if (!record) {
        throw new Error(`Douyin smoke session not found: ${sessionId}`);
      }
      console.log(JSON.stringify(record, null, 2));
      return;
    }
    case "watch": {
      const sessionId = requireSessionId(process.argv[3]);
      const intervalMs = Number.parseInt(process.env.DOUYIN_WATCH_INTERVAL_MS ?? "1000", 10);
      const timeoutMs = Number.parseInt(process.env.DOUYIN_WATCH_TIMEOUT_MS ?? "600000", 10);
      const deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline) {
        const record = getDouyinSmokeSessionStatus(workspaceRoot, sessionId);
        if (!record) {
          throw new Error(`Douyin smoke session not found: ${sessionId}`);
        }

        console.log(JSON.stringify(record, null, 2));

        if (record.status !== "running") {
          return;
        }

        await sleep(intervalMs);
      }

      throw new Error(`Timed out while watching Douyin smoke session: ${sessionId}`);
    }
    case "submit": {
      const sessionId = requireSessionId(process.argv[3]);
      const code = requireCode(process.argv[4]);
      const record = submitDouyinSmokeSessionCode(workspaceRoot, sessionId, code);
      console.log(JSON.stringify(record, null, 2));
      return;
    }
    case "stop": {
      const sessionId = requireSessionId(process.argv[3]);
      const record = stopDouyinSmokeSession(workspaceRoot, sessionId);
      console.log(JSON.stringify(record, null, 2));
      return;
    }
    case "worker": {
      const sessionId = requireSessionId(process.argv[3]);
      await runDouyinSmokeWorker(workspaceRoot, sessionId);
      return;
    }
    default:
      throw new Error(`Unsupported command: ${command}`);
  }
}

function requireSessionId(value: string | undefined): string {
  const sessionId = value?.trim();
  if (!sessionId) {
    throw new Error("A Douyin smoke session id is required.");
  }
  return sessionId;
}

function requireCode(value: string | undefined): string {
  const code = value?.trim();
  if (!code) {
    throw new Error("A verification code is required.");
  }
  return code;
}

function parseImagePaths(pathsValue: string | undefined, singleValue: string | undefined): string[] {
  const raw = pathsValue?.trim() || singleValue?.trim();
  if (raw) {
    const parsed = raw
      .split(/[|,]/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (parsed.length > 0) {
      return parsed;
    }
  }

  return [singleValue?.trim() || DEFAULT_IMAGE_PATH];
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

function resolveSmokeText(envValue: string | undefined, fileValue: string | undefined): string | undefined {
  return envValue?.trim() || fileValue?.trim() || undefined;
}

function resolveSmokeTags(envValue: string | undefined, fileValue: SmokeInputFile["tags"]): string[] {
  if (envValue?.trim()) {
    return parseTags(envValue);
  }

  if (Array.isArray(fileValue)) {
    const normalized = fileValue.map((tag) => tag.trim()).filter(Boolean);
    return normalized.length > 0 ? normalized : DEFAULT_TAGS;
  }

  if (typeof fileValue === "string") {
    const normalized = parseTags(fileValue);
    return normalized.length > 0 ? normalized : DEFAULT_TAGS;
  }

  return DEFAULT_TAGS;
}

function readSmokeInputFile(filePath: string | undefined): SmokeInputFile | null {
  const trimmedPath = filePath?.trim();
  if (!trimmedPath) {
    return null;
  }

  const raw = readFileSync(trimmedPath, "utf8");
  return JSON.parse(raw) as SmokeInputFile;
}

function parseMode(value: string | undefined): "image" | "video" {
  return value === "video" ? "video" : "image";
}

function parseCoverOrientation(value: string | undefined): "vertical" | "horizontal" {
  return value === "horizontal" ? "horizontal" : "vertical";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
