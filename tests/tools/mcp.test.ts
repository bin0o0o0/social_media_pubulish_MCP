import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  createTextJsonResult,
  handleCreateImagePostDraft,
  handleCreateVideoPostDraft
} from "../../src/tools/mcp.js";

describe("createTextJsonResult", () => {
  test("serializes a payload as MCP text content", () => {
    expect(createTextJsonResult({ ok: true })).toEqual({
      content: [
        {
          type: "text",
          text: '{\n  "ok": true\n}'
        }
      ]
    });
  });
});

describe("handleCreateImagePostDraft", () => {
  test("returns login_required when the platform adapter is not logged in", async () => {
    const dir = join(tmpdir(), `social-media-mcp-${crypto.randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    const imagePath = join(dir, "cover.webp");
    writeFileSync(imagePath, "fake webp bytes");

    const result = await handleCreateImagePostDraft(
      {
        platform: "xiaohongshu",
        title: "Title",
        content: "Body",
        images: [imagePath]
      },
      {
        platform: "xiaohongshu",
        capabilities: { imagePostDraft: true },
        async checkLoginStatus() {
          return { platform: "xiaohongshu", loggedIn: false, message: "login required" };
        },
        async openLoginPage() {
          return { platform: "xiaohongshu", opened: true, message: "opened" };
        },
        async createImagePostDraft() {
          return { platform: "xiaohongshu", status: "login_required", message: "login required" };
        }
      }
    );

    expect(JSON.parse(firstText(result))).toMatchObject({
      platform: "xiaohongshu",
      status: "login_required"
    });
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("handleCreateVideoPostDraft", () => {
  test("returns login_required when the Douyin adapter is not logged in", async () => {
    const dir = join(tmpdir(), `social-media-mcp-${crypto.randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    const videoPath = join(dir, "clip.mp4");
    writeFileSync(videoPath, "fake mp4 bytes");

    const result = await handleCreateVideoPostDraft(
      {
        platform: "douyin",
        title: "Title",
        content: "Body",
        video: videoPath
      },
      {
        platform: "douyin",
        capabilities: { imagePostDraft: true, videoPostDraft: true },
        async checkLoginStatus() {
          return { platform: "douyin", loggedIn: false, message: "login required" };
        },
        async openLoginPage() {
          return { platform: "douyin", opened: true, message: "opened" };
        },
        async createVideoPostDraft() {
          return { platform: "douyin", status: "login_required", message: "login required" };
        }
      }
    );

    expect(JSON.parse(firstText(result))).toMatchObject({
      platform: "douyin",
      status: "login_required"
    });
    rmSync(dir, { recursive: true, force: true });
  });

  test("returns draft_created when the Douyin adapter creates a video draft", async () => {
    const dir = join(tmpdir(), `social-media-mcp-${crypto.randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    const videoPath = join(dir, "clip.mov");
    writeFileSync(videoPath, "fake mov bytes");

    const result = await handleCreateVideoPostDraft(
      {
        platform: "douyin",
        title: "Title",
        content: "Body",
        video: videoPath
      },
      {
        platform: "douyin",
        capabilities: { imagePostDraft: true, videoPostDraft: true },
        async checkLoginStatus() {
          return { platform: "douyin", loggedIn: true, message: "logged in" };
        },
        async openLoginPage() {
          return { platform: "douyin", opened: true, message: "opened" };
        },
        async createVideoPostDraft() {
          return { platform: "douyin", status: "draft_created", message: "created" };
        }
      }
    );

    expect(JSON.parse(firstText(result))).toMatchObject({
      platform: "douyin",
      status: "draft_created"
    });
    rmSync(dir, { recursive: true, force: true });
  });

  test("returns a stable unsupported result when the platform has no video capability", async () => {
    const dir = join(tmpdir(), `social-media-mcp-${crypto.randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    const videoPath = join(dir, "clip.mp4");
    writeFileSync(videoPath, "fake mp4 bytes");

    const result = await handleCreateVideoPostDraft(
      {
        platform: "douyin",
        title: "Title",
        content: "Body",
        video: videoPath
      },
      {
        platform: "douyin",
        capabilities: { imagePostDraft: true },
        async checkLoginStatus() {
          return { platform: "douyin", loggedIn: true, message: "logged in" };
        },
        async openLoginPage() {
          return { platform: "douyin", opened: true, message: "opened" };
        }
      }
    );

    expect(JSON.parse(firstText(result))).toMatchObject({
      platform: "douyin",
      status: "failed",
      message: "Platform douyin does not support video post drafts."
    });
    rmSync(dir, { recursive: true, force: true });
  });
});

function firstText(result: ReturnType<typeof createTextJsonResult>): string {
  const item = result.content[0];

  if (item.type !== "text") {
    throw new Error(`Expected text content, got ${item.type}`);
  }

  return item.text;
}
