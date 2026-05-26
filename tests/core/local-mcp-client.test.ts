import { describe, expect, test } from "vitest";
import { getLocalServerCommand, parseTextToolResult } from "../../src/core/local-mcp-client.js";

describe("parseTextToolResult", () => {
  test("parses JSON payloads from text content", () => {
    expect(
      parseTextToolResult<{ status: string }>({
        content: [{ type: "text", text: '{ "status": "ok" }' }]
      })
    ).toEqual({ status: "ok" });
  });

  test("throws when MCP content is not text", () => {
    expect(() =>
      parseTextToolResult({
        content: [{ type: "image" }]
      })
    ).toThrow("Expected text MCP content.");
  });
});

describe("getLocalServerCommand", () => {
  test("uses the local tsx entrypoint for the project MCP server", () => {
    const command = getLocalServerCommand({ SOCIAL_MEDIA_MCP_PROFILE_SUFFIX: "test-profile" });

    expect(command.command).toBe(process.execPath);
    expect(command.args[0]).toContain("node_modules");
    expect(command.args[0]).toContain("tsx");
    expect(command.args[1]).toContain("src");
    expect(command.args[1]).toContain("server.ts");
    expect(command.env.SOCIAL_MEDIA_MCP_PROFILE_SUFFIX).toBe("test-profile");
  });
});
