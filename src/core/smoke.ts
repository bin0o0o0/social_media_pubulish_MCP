export function shouldCloseBrowserSessionsOnExit(): boolean {
  return process.env.SOCIAL_MEDIA_MCP_CLOSE_BROWSER_ON_EXIT === "1";
}
