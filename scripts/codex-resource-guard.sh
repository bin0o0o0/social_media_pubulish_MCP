#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${SOCIAL_MEDIA_GUARD_PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
INTERVAL_SECONDS="${SOCIAL_MEDIA_GUARD_INTERVAL_SECONDS:-30}"
MAX_MCP_SERVERS="${SOCIAL_MEDIA_GUARD_MAX_MCP_SERVERS:-1}"
MAX_NODE_REPL="${SOCIAL_MEDIA_GUARD_MAX_NODE_REPL:-}"
LOG_FILE="${SOCIAL_MEDIA_GUARD_LOG_FILE:-$PROJECT_ROOT/.social-media-mcp/resource-guard.log}"
PLIST="$HOME/Library/LaunchAgents/com.social-media-skill.codex-resource-guard.plist"

MODE="once"
DRY_RUN=0

usage() {
  cat <<EOF
Usage: $0 [--once|--watch|--status|--dry-run|--install-launch-agent|--uninstall-launch-agent]

Environment:
  SOCIAL_MEDIA_GUARD_INTERVAL_SECONDS  Default: 30
  SOCIAL_MEDIA_GUARD_MAX_MCP_SERVERS   Default: 1
  SOCIAL_MEDIA_GUARD_MAX_NODE_REPL     Default: disabled
  SOCIAL_MEDIA_GUARD_LOG_FILE          Default: .social-media-mcp/resource-guard.log
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --once) MODE="once" ;;
    --watch) MODE="watch" ;;
    --status) MODE="status" ;;
    --dry-run) DRY_RUN=1 ;;
    --install-launch-agent) MODE="install" ;;
    --uninstall-launch-agent) MODE="uninstall" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

mkdir -p "$(dirname "$LOG_FILE")"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG_FILE" >/dev/null
}

list_mcp_launchers() {
  ps -axo pid=,command= |
    awk '/node_modules\/tsx\/dist\/cli\.mjs src\/server\.ts$/ {print $1}' |
    sort -n
}

list_mcp_workers() {
  ps -axo pid=,command= |
    awk -v root="$PROJECT_ROOT" 'index($0, root "/node_modules/tsx/dist/") && index($0, "src/server.ts") {print $1}' |
    sort -n
}

list_node_repl() {
  ps -axo pid=,command= |
    awk '/\/ChatGPT\.app\/Contents\/Resources\/cua_node\/bin\/node_repl$/ {print $1}' |
    sort -n
}

children_of() {
  local pid="$1"
  pgrep -P "$pid" 2>/dev/null | sort -n || true
}

read_pids() {
  local array_name="$1"
  shift
  eval "$array_name=()"
  local pid
  while IFS= read -r pid; do
    [[ -n "$pid" ]] || continue
    eval "$array_name+=(\"\$pid\")"
  done < <("$@")
}

terminate_pid() {
  local pid="$1"
  local reason="$2"

  if ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "dry-run: would terminate pid=$pid reason=$reason"
    return 0
  fi

  log "terminating pid=$pid reason=$reason"
  kill -TERM "$pid" 2>/dev/null || true
}

trim_list_to_max() {
  local max_count="$1"
  local reason="$2"
  shift 2
  local pids=("$@")
  local count="${#pids[@]}"

  if (( count <= max_count )); then
    return 0
  fi

  local remove_count=$((count - max_count))
  local i
  for ((i = 0; i < remove_count; i++)); do
    terminate_pid "${pids[$i]}" "$reason"
  done
}

cleanup_once() {
  read_pids launchers list_mcp_launchers
  read_pids workers list_mcp_workers
  read_pids repls list_node_repl

  log "status before cleanup: mcp_launchers=${#launchers[@]} mcp_workers=${#workers[@]} node_repl=${#repls[@]}"

  if (( ${#launchers[@]} > MAX_MCP_SERVERS )); then
    local keep_from=$(( ${#launchers[@]} - MAX_MCP_SERVERS ))
    local i
    for ((i = 0; i < keep_from; i++)); do
      local launcher="${launchers[$i]}"
      read_pids child_pids children_of "$launcher"
      for child in "${child_pids[@]}"; do
        terminate_pid "$child" "duplicate social-media MCP worker"
      done
      terminate_pid "$launcher" "duplicate social-media MCP launcher"
    done
  fi

  read_pids workers_after list_mcp_workers
  trim_list_to_max "$MAX_MCP_SERVERS" "duplicate or orphan social-media MCP worker" "${workers_after[@]}"
  if [[ -n "$MAX_NODE_REPL" ]]; then
    trim_list_to_max "$MAX_NODE_REPL" "duplicate Codex node_repl" "${repls[@]}"
  fi

  read_pids launchers_after list_mcp_launchers
  read_pids workers_final list_mcp_workers
  read_pids repls_final list_node_repl
  log "status after cleanup: mcp_launchers=${#launchers_after[@]} mcp_workers=${#workers_final[@]} node_repl=${#repls_final[@]}"
}

print_status() {
  read_pids launchers list_mcp_launchers
  read_pids workers list_mcp_workers
  read_pids repls list_node_repl

  echo "project_root=$PROJECT_ROOT"
  echo "mcp_launchers=${#launchers[@]} ${launchers[*]:-}"
  echo "mcp_workers=${#workers[@]} ${workers[*]:-}"
  echo "node_repl=${#repls[@]} ${repls[*]:-}"
  echo "log_file=$LOG_FILE"
}

install_launch_agent() {
  mkdir -p "$HOME/Library/LaunchAgents"
  cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.social-media-skill.codex-resource-guard</string>
  <key>ProgramArguments</key>
  <array>
    <string>$PROJECT_ROOT/scripts/codex-resource-guard.sh</string>
    <string>--watch</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$PROJECT_ROOT/.social-media-mcp/resource-guard.stdout.log</string>
  <key>StandardErrorPath</key>
  <string>$PROJECT_ROOT/.social-media-mcp/resource-guard.stderr.log</string>
</dict>
</plist>
EOF
  launchctl unload "$PLIST" >/dev/null 2>&1 || true
  launchctl load "$PLIST"
  log "installed launch agent: $PLIST"
  echo "$PLIST"
}

uninstall_launch_agent() {
  launchctl unload "$PLIST" >/dev/null 2>&1 || true
  rm -f "$PLIST"
  log "uninstalled launch agent: $PLIST"
}

case "$MODE" in
  once) cleanup_once ;;
  watch)
    log "watch started: interval=${INTERVAL_SECONDS}s max_mcp=${MAX_MCP_SERVERS} max_node_repl=${MAX_NODE_REPL:-disabled}"
    while true; do
      cleanup_once
      sleep "$INTERVAL_SECONDS"
    done
    ;;
  status) print_status ;;
  install) install_launch_agent ;;
  uninstall) uninstall_launch_agent ;;
esac
