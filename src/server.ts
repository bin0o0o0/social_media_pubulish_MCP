import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  checkLoginStatusInputSchema,
  createImagePostDraftInputSchema,
  createVideoPostDraftInputSchema,
  openLoginPageInputSchema,
  submitVerificationCodeInputSchema
} from "./core/schemas.js";
import {
  handleCheckLoginStatus,
  handleCreateImagePostDraft,
  handleCreateVideoPostDraft,
  handleOpenLoginPage,
  handleSubmitVerificationCode
} from "./tools/mcp.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "social-media-pubulish-mcp",
    version: "0.1.0"
  });

  server.registerTool(
    "check_login_status",
    {
      title: "Check Login Status",
      description: "Check whether a platform browser session appears to be logged in.",
      inputSchema: checkLoginStatusInputSchema
    },
    async (args) => handleCheckLoginStatus(args)
  );

  server.registerTool(
    "open_login_page",
    {
      title: "Open Login Page",
      description: "Open the platform creator page so the user can log in manually.",
      inputSchema: openLoginPageInputSchema
    },
    async (args) => handleOpenLoginPage(args)
  );

  server.registerTool(
    "create_image_post_draft",
    {
      title: "Create Image Post Draft",
      description: "Create an image-post draft from prepared title, content, tags, and local image paths.",
      inputSchema: createImagePostDraftInputSchema
    },
    async (args) => handleCreateImagePostDraft(args)
  );

  server.registerTool(
    "create_video_post_draft",
    {
      title: "Create Video Post Draft",
      description: "Create a video-post draft from prepared title, content, tags, and a local video path.",
      inputSchema: createVideoPostDraftInputSchema
    },
    async (args) => handleCreateVideoPostDraft(args)
  );

  server.registerTool(
    "submit_verification_code",
    {
      title: "Submit Verification Code",
      description: "Submit a Douyin SMS verification code in the currently open verification dialog.",
      inputSchema: submitVerificationCodeInputSchema
    },
    async (args) => handleSubmitVerificationCode(args)
  );

  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  await server.connect(new StdioServerTransport());
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
