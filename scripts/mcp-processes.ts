import { execFileSync } from "node:child_process";
import process from "node:process";
import { classifySocialMediaMcpProcess, type ProcessSnapshot } from "../src/core/process-hygiene.js";

type ListedProcess = ProcessSnapshot & {
  kind: string;
};

const command = process.argv[2] ?? "list";
const workspaceRoot = process.cwd();
const matches = listMatchingProcesses(workspaceRoot);

if (command === "list") {
  console.log(JSON.stringify(matches, null, 2));
} else if (command === "kill") {
  for (const item of matches) {
    process.kill(item.processId);
  }
  console.log(JSON.stringify({ killed: matches.map((item) => item.processId) }, null, 2));
} else {
  throw new Error("Usage: tsx scripts/mcp-processes.ts [list|kill]");
}

function listMatchingProcesses(root: string): ListedProcess[] {
  if (process.platform !== "win32") {
    throw new Error("mcp-processes currently supports Windows PowerShell environments only.");
  }

  const raw = execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_Process -Filter \"name = 'node.exe'\" | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Depth 3"
    ],
    { encoding: "utf8" }
  ).trim();

  if (!raw) {
    return [];
  }

  const parsed = JSON.parse(raw) as unknown;
  const processes = Array.isArray(parsed) ? parsed : [parsed];

  return processes.flatMap((item) => {
    const snapshot = normalizeProcess(item);
    if (!Number.isInteger(snapshot.processId) || snapshot.processId <= 0) {
      return [];
    }

    const kind = classifySocialMediaMcpProcess(snapshot, root);
    return kind ? [{ ...snapshot, kind }] : [];
  });
}

function normalizeProcess(value: unknown): ProcessSnapshot {
  const item = value as { ProcessId?: unknown; Name?: unknown; CommandLine?: unknown };
  return {
    processId: Number(item.ProcessId),
    name: typeof item.Name === "string" ? item.Name : null,
    commandLine: typeof item.CommandLine === "string" ? item.CommandLine : null
  };
}
