import process from "node:process";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

type JsonObject = Record<string, unknown>;

export type LocalMcpClientSession = {
  client: Client;
  pid: number | null;
  close(): Promise<void>;
};

export function getLocalServerCommand(extraEnv: Record<string, string | undefined> = {}) {
  return {
    command: process.execPath,
    args: [resolve(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), resolve(process.cwd(), "src", "server.ts")],
    cwd: process.cwd(),
    env: mergeStringEnv(extraEnv),
    stderr: "inherit" as const
  };
}

export async function createLocalMcpClient(
  extraEnv: Record<string, string | undefined> = {}
): Promise<LocalMcpClientSession> {
  const transport = new StdioClientTransport(getLocalServerCommand(extraEnv));
  const client = new Client(
    {
      name: "social-media-mcp-smoke-client",
      version: "0.1.0"
    },
    {
      capabilities: {}
    }
  );

  await client.connect(transport);

  return {
    client,
    pid: transport.pid,
    async close() {
      await transport.close();
    }
  };
}

export async function callJsonTool<T extends JsonObject>(
  client: Client,
  name: string,
  args: JsonObject
): Promise<T> {
  const result = (await client.callTool({
    name,
    arguments: args
  })) as CallToolResult;

  return parseTextToolResult<T>(result);
}

export function parseTextToolResult<T>(result: { content: Array<{ type: string; text?: string }> }): T {
  const item = result.content[0];

  if (!item || item.type !== "text" || !item.text) {
    throw new Error("Expected text MCP content.");
  }

  return JSON.parse(item.text) as T;
}

function mergeStringEnv(extraEnv: Record<string, string | undefined>): Record<string, string> {
  const merged: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      merged[key] = value;
    }
  }

  for (const [key, value] of Object.entries(extraEnv)) {
    if (typeof value === "string") {
      merged[key] = value;
    }
  }

  return merged;
}
