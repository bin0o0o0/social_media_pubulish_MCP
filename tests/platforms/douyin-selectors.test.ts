import { describe, expect, test } from "vitest";
import {
  chooseDouyinFileInputIndex,
  douyinSelectorDiagnostics,
  formatDouyinAddedImagesText,
  formatDouyinCaption
} from "../../src/platforms/douyin.js";

describe("douyin selector diagnostics", () => {
  test("keeps critical login, upload, publish, and verification selectors in readable Chinese", () => {
    expect(douyinSelectorDiagnostics.loginSignals.join(" ")).toContain("登录");
    expect(douyinSelectorDiagnostics.loginSignals.join(" ")).toContain("扫码");
    expect(douyinSelectorDiagnostics.imageModeSelectors.join(" ")).toContain("图文");
    expect(douyinSelectorDiagnostics.titleSelectors.join(" ")).toContain("标题");
    expect(douyinSelectorDiagnostics.contentSelectors.join(" ")).toContain("简介");
    expect(douyinSelectorDiagnostics.imageUploadReadySelectors.join(" ")).toContain("已添加");
    expect(douyinSelectorDiagnostics.videoUploadReadySelectors.join(" ")).toContain("设置封面");
    expect(douyinSelectorDiagnostics.privateVisibilitySelectors.join(" ")).toContain("仅自己可见");
    expect(douyinSelectorDiagnostics.publishButtonSelectors.join(" ")).toContain("发布");
    expect(douyinSelectorDiagnostics.verificationModalSelectors.join(" ")).toContain("验证码");
  });

  test("formats douyin caption tags inline instead of line-by-line bullets", () => {
    expect(formatDouyinCaption("正文", ["mcp", "#douyin", "smoke-test"])).toBe(
      "正文\n\n#mcp #douyin #smoke-test"
    );
  });

  test("formats expected uploaded image count text", () => {
    expect(formatDouyinAddedImagesText(3)).toBe("已添加3张图片");
  });

  test("chooses the actual video file input instead of the image input on the video page", () => {
    expect(
      chooseDouyinFileInputIndex(
        [
          { accept: "image/png,image/jpeg,image/jpg", multiple: false },
          { accept: "video/mp4,video/x-m4v,.mov,video/*", multiple: false }
        ],
        "video"
      )
    ).toBe(1);
  });
});
