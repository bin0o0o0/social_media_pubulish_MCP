import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createTextJsonResult, handleCreateImagePostDraft } from "../../src/tools/mcp.js";

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

function firstText(result: ReturnType<typeof createTextJsonResult>): string {
  const item = result.content[0];

  if (item.type !== "text") {
    throw new Error(`Expected text content, got ${item.type}`);
  }

  return item.text;
}
