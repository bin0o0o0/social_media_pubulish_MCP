import { describe, expect, test } from "vitest";
import { classifySocialMediaMcpProcess } from "../../src/core/process-hygiene.js";

describe("classifySocialMediaMcpProcess", () => {
  test("identifies project MCP server and smoke worker processes only inside the workspace", () => {
    const workspaceRoot = "D:/work/2026/code/social_media_skill";

    expect(
      classifySocialMediaMcpProcess(
        {
          processId: 100,
          name: "node.exe",
          commandLine:
            "E:/nodejs/node.exe D:/work/2026/code/social_media_skill/node_modules/tsx/dist/cli.mjs src/server.ts"
        },
        workspaceRoot
      )
    ).toBe("mcp-server");

    expect(
      classifySocialMediaMcpProcess(
        {
          processId: 101,
          name: "node.exe",
          commandLine:
            "E:/nodejs/node.exe D:/work/2026/code/social_media_skill/node_modules/tsx/dist/cli.mjs scripts/smoke-douyin-draft.ts worker douyin-1"
        },
        workspaceRoot
      )
    ).toBe("smoke-worker");

    expect(
      classifySocialMediaMcpProcess(
        {
          processId: 102,
          name: "node_repl.exe",
          commandLine: "C:/Users/Administrator/AppData/Local/OpenAI/Codex/runtimes/cua_node/bin/node_repl.exe"
        },
        workspaceRoot
      )
    ).toBeNull();

    expect(
      classifySocialMediaMcpProcess(
        {
          processId: 103,
          name: "node.exe",
          commandLine:
            "E:/nodejs/node.exe D:/work/2026/code/other_project/node_modules/tsx/dist/cli.mjs src/server.ts"
        },
        workspaceRoot
      )
    ).toBeNull();
  });

  test("normalizes macOS paths and node process names", () => {
    const workspaceRoot = "/Volumes/work/2026/code/social-media-skill";

    expect(
      classifySocialMediaMcpProcess(
        {
          processId: 200,
          name: "node",
          commandLine:
            "/Users/bin0.o/.codex/bin/node /Volumes/work/2026/code/social-media-skill/node_modules/tsx/dist/cli.mjs src/server.ts"
        },
        workspaceRoot
      )
    ).toBe("mcp-server");
  });
});
