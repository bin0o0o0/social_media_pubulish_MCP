import { callJsonTool, createLocalMcpClient } from "../src/core/local-mcp-client.js";

async function main(): Promise<void> {
  const toolName = process.argv[2] || process.env.MCP_SMOKE_TOOL_NAME;
  const rawInput = process.argv[3] || process.env.MCP_SMOKE_TOOL_ARGS_JSON || "{}";

  if (!toolName) {
    throw new Error("Usage: tsx scripts/mcp-smoke-client.ts <tool-name> '<json-args>'");
  }

  let args: Record<string, unknown>;
  try {
    args = JSON.parse(rawInput) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Failed to parse MCP tool args JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  const session = await createLocalMcpClient();

  try {
    const result = await callJsonTool<Record<string, unknown>>(session.client, toolName, args);
    console.log(JSON.stringify({ toolName, serverPid: session.pid, result }, null, 2));
  } finally {
    await session.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
