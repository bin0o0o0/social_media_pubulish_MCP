import { afterEach, describe, expect, test } from "vitest";
import { shouldCloseBrowserSessionsOnExit } from "../../src/core/smoke.js";

afterEach(() => {
  delete process.env.SOCIAL_MEDIA_MCP_CLOSE_BROWSER_ON_EXIT;
});

describe("shouldCloseBrowserSessionsOnExit", () => {
  test("keeps the browser open by default", () => {
    expect(shouldCloseBrowserSessionsOnExit()).toBe(false);
  });

  test("closes the browser only when explicitly requested", () => {
    process.env.SOCIAL_MEDIA_MCP_CLOSE_BROWSER_ON_EXIT = "1";

    expect(shouldCloseBrowserSessionsOnExit()).toBe(true);
  });
});
