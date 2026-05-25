import { describe, expect, test } from "vitest";
import { formatTopicTags } from "../../src/core/tags.js";

describe("formatTopicTags", () => {
  test("normalizes tags to hashtag format", () => {
    expect(formatTopicTags(["mcp", "#automation", " 小红书 "])).toEqual(["#mcp", "#automation", "#小红书"]);
  });

  test("removes duplicate and empty tags", () => {
    expect(formatTopicTags(["mcp", "#mcp", " ", "douyin"])).toEqual(["#mcp", "#douyin"]);
  });
});
