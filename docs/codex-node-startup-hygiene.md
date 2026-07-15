# Codex Node Startup Hygiene

This note documents a local Codex Desktop issue that can make the machine feel slow after restarting Codex.

## Symptom

After Codex Desktop starts, Task Manager may show many `node.exe` processes even when this repository's MCP server is not running.

The project MCP process normally looks like:

```text
tsx src/server.ts
scripts/smoke-douyin-draft.ts worker
```

The heavier plugin MCP processes observed on this machine looked like:

```text
node ./mcp/server.cjs --stdio
node ./mcp/server.mjs
```

These came from Codex plugins, not from this repository.

## Root Cause Found

The repeated startup Node processes were from these Codex plugin MCP manifests:

```text
C:\Users\Administrator\.codex\plugins\cache\openai-curated-remote\data-analytics\0.2.8-13ceeea1f599\.mcp.json
C:\Users\Administrator\.codex\plugins\cache\openai-bundled\sites\0.1.27\.mcp.json
```

`data-analytics` declared `./mcp/server.cjs --stdio`.
`sites` declared `./mcp/server.mjs`.

When Codex loads those plugin MCP servers multiple times, it can create several `node.exe` processes unrelated to this project's social media MCP.

## Local Mitigation Applied

The two `.mcp.json` files above were backed up, then changed to:

```json
{
  "mcpServers": {}
}
```

This keeps the plugin files in place but prevents those plugin MCP servers from being declared at startup.

Existing plugin MCP processes were then stopped by matching only:

```text
./mcp/server.cjs
./mcp/server.mjs
```

This does not delete this repository, its skills, or `.social-media-mcp/` browser login profiles.

## Verify Current State

Check this repository's MCP/worker processes:

```powershell
npm run mcp:processes
```

Check plugin MCP processes:

```powershell
Get-CimInstance Win32_Process -Filter "name = 'node.exe'" |
  Where-Object {
    $_.CommandLine -like '*./mcp/server.cjs*' -or
    $_.CommandLine -like '*./mcp/server.mjs*'
  } |
  Select-Object ProcessId,ParentProcessId,CommandLine
```

After mitigation, the second command should return no plugin MCP server processes unless the manifests were restored or Codex reinstalled the plugins.

## Restore If Needed

If Data Analytics dashboards or Sites deployment tools are needed again, restore the newest backup next to each manifest:

```powershell
Copy-Item `
  'C:\Users\Administrator\.codex\plugins\cache\openai-curated-remote\data-analytics\0.2.8-13ceeea1f599\.mcp.json.backup-<timestamp>' `
  'C:\Users\Administrator\.codex\plugins\cache\openai-curated-remote\data-analytics\0.2.8-13ceeea1f599\.mcp.json' `
  -Force

Copy-Item `
  'C:\Users\Administrator\.codex\plugins\cache\openai-bundled\sites\0.1.27\.mcp.json.backup-<timestamp>' `
  'C:\Users\Administrator\.codex\plugins\cache\openai-bundled\sites\0.1.27\.mcp.json' `
  -Force
```

Then restart Codex Desktop.
