import { describe, expect, test } from "vitest";
import { getPlatformAdapter } from "../../src/platforms/index.js";

describe("getPlatformAdapter", () => {
  test("returns the xiaohongshu adapter", () => {
    expect(getPlatformAdapter("xiaohongshu").platform).toBe("xiaohongshu");
  });

  test("returns the douyin adapter", () => {
    expect(getPlatformAdapter("douyin").platform).toBe("douyin");
  });

  test("returns article adapters", () => {
    expect(getPlatformAdapter("csdn").platform).toBe("csdn");
    expect(getPlatformAdapter("zhihu").platform).toBe("zhihu");
    expect(getPlatformAdapter("wechat").platform).toBe("wechat");
  });

  test("exposes draft capabilities per platform", () => {
    expect(getPlatformAdapter("xiaohongshu").capabilities).toEqual({
      imagePostDraft: true
    });
    expect(getPlatformAdapter("douyin").capabilities).toEqual({
      imagePostDraft: true,
      videoPostDraft: true,
      verificationCodeSubmission: true
    });
    expect(getPlatformAdapter("csdn").capabilities).toEqual({ articlePostDraft: true });
    expect(getPlatformAdapter("zhihu").capabilities).toEqual({ articlePostDraft: true });
    expect(getPlatformAdapter("wechat").capabilities).toEqual({ articlePostDraft: true });
  });

  test("rejects an unknown platform", () => {
    expect(() => getPlatformAdapter("bilibili" as never)).toThrow("Unsupported platform: bilibili");
  });
});
