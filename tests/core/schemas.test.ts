import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import {
  createImagePostDraftInputSchema,
  createVideoPostDraftInputSchema
} from "../../src/core/schemas.js";

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

describe("createVideoPostDraftInputSchema", () => {
  test("accepts valid Douyin video post draft input", () => {
    const dir = mkdirTestDir();
    const videoPath = join(dir, "clip.mp4");
    writeFileSync(videoPath, "fake mp4 bytes");

    const parsed = createVideoPostDraftInputSchema.parse({
      platform: "douyin",
      title: "Launch video",
      content: "This is a prepared video post.",
      video: videoPath,
      tags: ["mcp", "#automation"]
    });

    expect(parsed).toEqual({
      platform: "douyin",
      title: "Launch video",
      content: "This is a prepared video post.",
      video: videoPath,
      tags: ["mcp", "#automation"]
    });

    rmSync(dir, { recursive: true, force: true });
  });

  test("rejects a non-Douyin video platform", () => {
    const dir = mkdirTestDir();
    const videoPath = join(dir, "clip.mov");
    writeFileSync(videoPath, "fake mov bytes");

    const result = createVideoPostDraftInputSchema.safeParse({
      platform: "xiaohongshu",
      title: "Title",
      content: "Body",
      video: videoPath
    });

    expect(result.success).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  test("rejects an empty video title", () => {
    const dir = mkdirTestDir();
    const videoPath = join(dir, "clip.m4v");
    writeFileSync(videoPath, "fake m4v bytes");

    const result = createVideoPostDraftInputSchema.safeParse({
      platform: "douyin",
      title: " ",
      content: "Body",
      video: videoPath
    });

    expect(result.success).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  test("rejects an empty video content body", () => {
    const dir = mkdirTestDir();
    const videoPath = join(dir, "clip.mp4");
    writeFileSync(videoPath, "fake mp4 bytes");

    const result = createVideoPostDraftInputSchema.safeParse({
      platform: "douyin",
      title: "Title",
      content: "",
      video: videoPath
    });

    expect(result.success).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  test("rejects a missing video path", () => {
    const result = createVideoPostDraftInputSchema.safeParse({
      platform: "douyin",
      title: "Title",
      content: "Body",
      video: join(tmpdir(), "missing-social-media-video.mp4")
    });

    expect(result.success).toBe(false);
  });

  test("rejects unsupported video extensions", () => {
    const dir = mkdirTestDir();
    const videoPath = join(dir, "clip.txt");
    writeFileSync(videoPath, "fake text bytes");

    const result = createVideoPostDraftInputSchema.safeParse({
      platform: "douyin",
      title: "Title",
      content: "Body",
      video: videoPath
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
