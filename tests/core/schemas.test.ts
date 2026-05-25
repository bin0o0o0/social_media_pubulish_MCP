import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import { createImagePostDraftInputSchema } from "../../src/core/schemas.js";

describe("createImagePostDraftInputSchema", () => {
  test("accepts valid image post draft input", () => {
    const dir = mkdirTestDir();
    const imagePath = join(dir, "cover.png");
    writeFileSync(imagePath, "fake png bytes");

    const parsed = createImagePostDraftInputSchema.parse({
      platform: "xiaohongshu",
      title: "Launch notes",
      content: "This is a prepared post.",
      images: [imagePath],
      tags: ["mcp", "#automation"]
    });

    expect(parsed).toEqual({
      platform: "xiaohongshu",
      title: "Launch notes",
      content: "This is a prepared post.",
      images: [imagePath],
      tags: ["mcp", "#automation"]
    });

    rmSync(dir, { recursive: true, force: true });
  });

  test("rejects an empty title", () => {
    const dir = mkdirTestDir();
    const imagePath = join(dir, "cover.jpg");
    writeFileSync(imagePath, "fake jpg bytes");

    const result = createImagePostDraftInputSchema.safeParse({
      platform: "douyin",
      title: " ",
      content: "Body",
      images: [imagePath]
    });

    expect(result.success).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  test("rejects an empty content body", () => {
    const dir = mkdirTestDir();
    const imagePath = join(dir, "cover.jpeg");
    writeFileSync(imagePath, "fake jpeg bytes");

    const result = createImagePostDraftInputSchema.safeParse({
      platform: "xiaohongshu",
      title: "Title",
      content: "",
      images: [imagePath]
    });

    expect(result.success).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  test("rejects an empty image list", () => {
    const result = createImagePostDraftInputSchema.safeParse({
      platform: "douyin",
      title: "Title",
      content: "Body",
      images: []
    });

    expect(result.success).toBe(false);
  });

  test("rejects a missing image path", () => {
    const result = createImagePostDraftInputSchema.safeParse({
      platform: "xiaohongshu",
      title: "Title",
      content: "Body",
      images: [join(tmpdir(), "missing-social-media-image.png")]
    });

    expect(result.success).toBe(false);
  });

  test("rejects unsupported image extensions", () => {
    const dir = mkdirTestDir();
    const imagePath = join(dir, "notes.gif");
    writeFileSync(imagePath, "fake gif bytes");

    const result = createImagePostDraftInputSchema.safeParse({
      platform: "douyin",
      title: "Title",
      content: "Body",
      images: [imagePath]
    });

    expect(result.success).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });
});

function mkdirTestDir(): string {
  const dir = join(tmpdir(), `social-media-mcp-${crypto.randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}
