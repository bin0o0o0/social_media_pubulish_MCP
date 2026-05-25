import { describe, expect, test } from "vitest";
import { getPlatformAdapter } from "../../src/platforms/index.js";

describe("getPlatformAdapter", () => {
  test("returns the xiaohongshu adapter", () => {
    expect(getPlatformAdapter("xiaohongshu").platform).toBe("xiaohongshu");
  });

  test("returns the douyin adapter", () => {
    expect(getPlatformAdapter("douyin").platform).toBe("douyin");
  });

  test("exposes image and video draft capabilities per platform", () => {
    expect(getPlatformAdapter("xiaohongshu").capabilities).toEqual({
      imagePostDraft: true
    });
    expect(getPlatformAdapter("douyin").capabilities).toEqual({
      imagePostDraft: true,
      videoPostDraft: true
    });
  });

  test("rejects an unknown platform", () => {
    expect(() => getPlatformAdapter("wechat" as never)).toThrow("Unsupported platform: wechat");
  });
});
