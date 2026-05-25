import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  checkLoginStatusInputSchema,
  createImagePostDraftInputSchema,
  openLoginPageInputSchema,
  type CheckLoginStatusInput,
  type CreateImagePostDraftInput,
  type OpenLoginPageInput
} from "../core/schemas.js";
import { getPlatformAdapter } from "../platforms/index.js";
import type { PlatformAdapter } from "../platforms/types.js";

export function createTextJsonResult(payload: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}

export async function handleCheckLoginStatus(
  input: CheckLoginStatusInput,
  adapter = getPlatformAdapter(input.platform)
): Promise<CallToolResult> {
  try {
    const parsed = checkLoginStatusInputSchema.parse(input);
    const result = await adapter.checkLoginStatus();
    return createTextJsonResult(result);
  } catch (error) {
    return createTextJsonResult({
      platform: input.platform,
      loggedIn: false,
      message: errorMessage(error)
    });
  }
}

export async function handleOpenLoginPage(
  input: OpenLoginPageInput,
  adapter = getPlatformAdapter(input.platform)
): Promise<CallToolResult> {
  try {
    const parsed = openLoginPageInputSchema.parse(input);
    const result = await adapter.openLoginPage();
    return createTextJsonResult(result);
  } catch (error) {
    return createTextJsonResult({
      platform: input.platform,
      opened: false,
      message: errorMessage(error)
    });
  }
}

export async function handleCreateImagePostDraft(
  input: CreateImagePostDraftInput,
  adapter: PlatformAdapter = getPlatformAdapter(input.platform)
): Promise<CallToolResult> {
  try {
    const parsed = createImagePostDraftInputSchema.parse(input);
    const result = await adapter.createImagePostDraft(parsed);
    return createTextJsonResult(result);
  } catch (error) {
    return createTextJsonResult({
      platform: input.platform,
      status: "failed",
      message: errorMessage(error)
    });
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
