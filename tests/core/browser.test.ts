import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { getPlatformUserDataDir } from "../../src/core/browser.js";

describe("getPlatformUserDataDir", () => {
  test("stores each platform in an isolated local user data directory", () => {
    expect(getPlatformUserDataDir("xiaohongshu")).toBe(
      join(process.cwd(), ".social-media-mcp", "xiaohongshu")
    );
    expect(getPlatformUserDataDir("douyin")).toBe(join(process.cwd(), ".social-media-mcp", "douyin"));
  });
});
