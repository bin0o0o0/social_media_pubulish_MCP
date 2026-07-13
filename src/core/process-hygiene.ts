export type ProcessSnapshot = {
  processId: number;
  name: string | null;
  commandLine: string | null;
};

export type SocialMediaMcpProcessKind = "mcp-server" | "smoke-worker";

export function classifySocialMediaMcpProcess(
  process: ProcessSnapshot,
  workspaceRoot: string
): SocialMediaMcpProcessKind | null {
  const name = process.name?.toLowerCase() ?? "";
  if (name !== "node.exe" && name !== "node") {
    return null;
  }

  const commandLine = normalizePath(process.commandLine ?? "");
  const root = normalizePath(workspaceRoot);
  if (!commandLine.includes(root)) {
    return null;
  }

  if (commandLine.includes("src/server.ts")) {
    return "mcp-server";
  }

  if (commandLine.includes("scripts/smoke-douyin-draft.ts") && commandLine.includes(" worker ")) {
    return "smoke-worker";
  }

  return null;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").toLowerCase();
}
