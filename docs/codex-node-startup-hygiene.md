# Codex Node Startup Hygiene

This note documents local Codex Desktop process growth that can make the machine feel slow during long sessions.

## Symptom

After Codex Desktop runs for a while, the system may show many Node processes for this repository even when only one social media automation task is expected.

This project's MCP and smoke processes normally look like:

```text
tsx src/server.ts
scripts/smoke-douyin-draft.ts worker
```

Each extra MCP server can keep a Node worker resident. On memory-constrained machines, repeated workers can increase memory pressure and make typing feel laggy.

## Project-Level Prevention

The Douyin smoke controller now checks for an active session with the same `SOCIAL_MEDIA_MCP_PROFILE_SUFFIX` before spawning a new worker. If it finds one in `running` or `awaiting_verification` state and the worker PID is still alive, it reuses that session instead of starting a duplicate worker.

## Process Inspection

Check this repository's MCP and smoke worker processes:

```bash
npm run mcp:processes
```

Kill only processes classified as this repository's MCP or smoke worker:

```bash
npm run mcp:processes:kill
```

The command only matches the current project path and these entrypoints:

```text
src/server.ts
scripts/smoke-douyin-draft.ts worker
```

It does not delete `.social-media-mcp/`, so browser login profiles stay intact.

## macOS Long-Running Guard

On macOS, this repository also includes a lightweight resource guard that keeps only one project MCP server around:

```bash
npm run guard:codex:status
npm run guard:codex
npm run guard:codex:install
```

Stop the background guard:

```bash
npm run guard:codex:uninstall
```

By default the guard checks every 30 seconds and only cleans this repository's duplicate MCP server processes.
