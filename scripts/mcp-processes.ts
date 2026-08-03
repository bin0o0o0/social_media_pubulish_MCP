import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import process from "node:process";
import { classifySocialMediaMcpProcess, type ProcessSnapshot } from "../src/core/process-hygiene.js";

type ListedProcess = ProcessSnapshot & {
  kind: string;
};

const command = process.argv[2] ?? "list";
const workspaceRoot = realpathSync(process.cwd());
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
  const processes = process.platform === "win32" ? listWindowsNodeProcesses() : listUnixNodeProcesses();
  return processes.flatMap((snapshot) => {
    if (!Number.isInteger(snapshot.processId) || snapshot.processId <= 0) {
      return [];
    }

    const kind = classifySocialMediaMcpProcess(snapshot, root);
    return kind ? [{ ...snapshot, kind }] : [];
  });
}

function listWindowsNodeProcesses(): ProcessSnapshot[] {
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
  return processes.map(normalizeWindowsProcess);
}

function normalizeWindowsProcess(value: unknown): ProcessSnapshot {
  const item = value as { ProcessId?: unknown; Name?: unknown; CommandLine?: unknown };
  return {
    processId: Number(item.ProcessId),
    name: typeof item.Name === "string" ? item.Name : null,
    commandLine: typeof item.CommandLine === "string" ? item.CommandLine : null
  };
}

function listUnixNodeProcesses(): ProcessSnapshot[] {
  const raw = execFileSync("ps", ["-axo", "pid=,comm=,command="], { encoding: "utf8" });
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(normalizeUnixProcess);
}

function normalizeUnixProcess(line: string): ProcessSnapshot {
  const match = line.match(/^(\d+)\s+(\S+)\s+(.*)$/);
  if (!match) {
    return { processId: Number.NaN, name: null, commandLine: line };
  }

  const processId = Number(match[1]);
  const commandLine = match[3];
  const cwd = getUnixCwd(processId);
  const scopedCommandLine =
    cwd && commandLine.includes("src/server.ts") && !commandLine.includes(workspaceRoot)
      ? `${cwd} ${commandLine}`
      : commandLine;

  return {
    processId,
    name: match[2].split("/").pop() ?? match[2],
    commandLine: scopedCommandLine
  };
}

function getUnixCwd(processId: number): string | null {
  try {
    if (process.platform === "darwin") {
      const raw = execFileSync("lsof", ["-a", "-p", String(processId), "-d", "cwd", "-Fn"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      });
      const cwd = raw
        .split("\n")
        .find((line) => line.startsWith("n"))
        ?.slice(1);
      return cwd ? realpathSync(cwd) : null;
    }

    return realpathSync(`/proc/${processId}/cwd`);
  } catch {
    return null;
  }
}
