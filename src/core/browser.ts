import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import type { Platform } from "./schemas.js";

export type BrowserSession = {
  context: BrowserContext;
  page: Page;
};

const sessions = new Map<Platform, Promise<BrowserSession>>();

export function getPlatformUserDataDir(platform: Platform): string {
  const suffix = process.env.SOCIAL_MEDIA_MCP_PROFILE_SUFFIX?.trim();
  const directoryName = suffix ? `${platform}-${suffix}` : platform;
  return join(process.cwd(), ".social-media-mcp", directoryName);
}

export async function getBrowserSession(platform: Platform): Promise<BrowserSession> {
  const existing = sessions.get(platform);

  if (existing) {
    return existing;
  }

  const created = createBrowserSession(platform);
  sessions.set(platform, created);
  return created;
}

async function createBrowserSession(platform: Platform): Promise<BrowserSession> {
  const userDataDir = getPlatformUserDataDir(platform);
  mkdirSync(userDataDir, { recursive: true });

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true
  });

  const page = context.pages()[0] ?? (await context.newPage());
  page.setDefaultTimeout(15_000);
  return { context, page };
}

export async function closeBrowserSessions(): Promise<void> {
  const activeSessions = await Promise.allSettled(sessions.values());
  sessions.clear();

  await Promise.all(
    activeSessions.map(async (session) => {
      if (session.status === "fulfilled") {
        await session.value.context.close();
      }
    })
  );
}
