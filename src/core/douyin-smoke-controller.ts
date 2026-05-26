import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import process from "node:process";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { callJsonTool, createLocalMcpClient } from "./local-mcp-client.js";
import {
  attachVerificationCodeToSession,
  createDouyinSmokeSessionRecord,
  markDouyinSmokeSessionStopRequested,
  readDouyinSmokeSession,
  updateDouyinSmokeSession,
  type DouyinSmokeSessionMode,
  type DouyinSmokeSessionRecord
} from "./douyin-smoke-session.js";

export type StartDouyinSmokeSessionInput = {
  workspaceRoot: string;
  profileSuffix: string | null;
  mode: DouyinSmokeSessionMode;
  draftInput: DouyinSmokeSessionRecord["draftInput"];
  settings: DouyinSmokeSessionRecord["settings"];
};

type LoginStatusResult = {
  platform: "douyin";
  loggedIn: boolean;
  message: string;
};

type PostDraftResult = {
  platform: "douyin";
  status: "draft_created" | "login_required" | "verification_required" | "failed";
  message: string;
};

type VerificationResult = {
  platform: "douyin";
  status: "verified" | "failed";
  message: string;
};

export function startDouyinSmokeSession(input: StartDouyinSmokeSessionInput): DouyinSmokeSessionRecord {
  const sessionId = `douyin-${Date.now()}-${randomUUID().slice(0, 8)}`;
  let record = createDouyinSmokeSessionRecord({
    sessionId,
    profileSuffix: input.profileSuffix,
    mode: input.mode,
    draftInput: input.draftInput,
    settings: input.settings
  });
  record = updateDouyinSmokeSession(input.workspaceRoot, record);

  const child = spawn(
    process.execPath,
    [
      resolveTsxEntrypoint(input.workspaceRoot),
      resolveDouyinScriptEntrypoint(input.workspaceRoot),
      "worker",
      sessionId
    ],
    {
      cwd: input.workspaceRoot,
      env: process.env,
      stdio: "ignore",
      detached: true,
      windowsHide: true
    }
  );
  child.unref();

  record = updateDouyinSmokeSession(input.workspaceRoot, {
    ...record,
    workerPid: child.pid ?? null,
    status: "running",
    message: "Douyin smoke session started."
  });

  return record;
}

export function getDouyinSmokeSessionStatus(workspaceRoot: string, sessionId: string) {
  return readDouyinSmokeSession(workspaceRoot, sessionId);
}

export function submitDouyinSmokeSessionCode(
  workspaceRoot: string,
  sessionId: string,
  code: string
): DouyinSmokeSessionRecord {
  const session = requireSession(workspaceRoot, sessionId);
  const updated = attachVerificationCodeToSession(session, code);
  return updateDouyinSmokeSession(workspaceRoot, {
    ...updated,
    message: "Verification code received. Waiting for worker to submit it."
  });
}

export function stopDouyinSmokeSession(workspaceRoot: string, sessionId: string): DouyinSmokeSessionRecord {
  const session = requireSession(workspaceRoot, sessionId);
  const updated = markDouyinSmokeSessionStopRequested(session);
  return updateDouyinSmokeSession(workspaceRoot, {
    ...updated,
    message: "Stop requested."
  });
}

export async function runDouyinSmokeWorker(workspaceRoot: string, sessionId: string): Promise<void> {
  let session = requireSession(workspaceRoot, sessionId);
  const clientSession = await createLocalMcpClient({
    SOCIAL_MEDIA_MCP_PROFILE_SUFFIX: session.profileSuffix ?? undefined
  });

  try {
    session = persist(workspaceRoot, {
      ...session,
      workerPid: process.pid,
      status: "running",
      message: "Worker connected to the local MCP server."
    });

    if (session.stopRequested) {
      persist(workspaceRoot, {
        ...session,
        status: "stopped",
        message: "Worker stopped before starting publish flow."
      });
      return;
    }

    let loginStatus = await checkLoginStatus(clientSession.client);
    session = persist(workspaceRoot, {
      ...session,
      lastResult: loginStatus,
      message: loginStatus.message
    });

    if (!loginStatus.loggedIn && session.settings.autoOpenLogin) {
      const opened = await callJsonTool<Record<string, unknown>>(clientSession.client, "open_login_page", { platform: "douyin" });
      session = persist(workspaceRoot, {
        ...session,
        lastResult: opened,
        message: "Opened Douyin login page."
      });

      if (session.settings.loginInitialWaitMs > 0) {
        await sleep(session.settings.loginInitialWaitMs);
      }

      loginStatus = await pollLoginStatus(clientSession.client, workspaceRoot, sessionId);
      session = requireSession(workspaceRoot, sessionId);
    }

    if (!loginStatus.loggedIn) {
      persist(workspaceRoot, {
        ...session,
        status: "failed",
        lastResult: loginStatus,
        message: loginStatus.message
      });
      await waitUntilStopRequested(workspaceRoot, sessionId);
      return;
    }

    const draftResult =
      session.mode === "video"
        ? await createVideoDraft(clientSession.client, session)
        : await createImageDraft(clientSession.client, session);
    session = persist(workspaceRoot, {
      ...requireSession(workspaceRoot, sessionId),
      lastResult: draftResult,
      message: draftResult.message,
      status:
        draftResult.status === "verification_required"
          ? "awaiting_verification"
          : draftResult.status === "draft_created"
            ? "completed"
            : "failed"
    });

    if (draftResult.status === "verification_required") {
      const code = await waitForVerificationCode(workspaceRoot, sessionId);
      if (!code) {
        persist(workspaceRoot, {
          ...requireSession(workspaceRoot, sessionId),
          status: "stopped",
          message: "Worker stopped before verification code was submitted."
        });
        return;
      }

      const verificationResult = await callJsonTool<VerificationResult>(clientSession.client, "submit_verification_code", {
        platform: "douyin",
        code
      });

      persist(workspaceRoot, {
        ...requireSession(workspaceRoot, sessionId),
        lastResult: verificationResult,
        status: verificationResult.status === "verified" ? "completed" : "failed",
        message: verificationResult.message
      });
    }

    await waitUntilStopRequested(workspaceRoot, sessionId);
  } finally {
    await clientSession.close().catch(() => undefined);
  }
}

function requireSession(workspaceRoot: string, sessionId: string): DouyinSmokeSessionRecord {
  const session = readDouyinSmokeSession(workspaceRoot, sessionId);
  if (!session) {
    throw new Error(`Douyin smoke session not found: ${sessionId}`);
  }
  return session;
}

function persist(workspaceRoot: string, record: DouyinSmokeSessionRecord): DouyinSmokeSessionRecord {
  return updateDouyinSmokeSession(workspaceRoot, record);
}

async function checkLoginStatus(client: Client) {
  return callJsonTool<LoginStatusResult>(client, "check_login_status", { platform: "douyin" });
}

async function createImageDraft(client: Client, session: DouyinSmokeSessionRecord) {
  return callJsonTool<PostDraftResult>(client, "create_image_post_draft", {
    platform: "douyin",
    title: session.draftInput.title,
    content: session.draftInput.content,
    images: session.draftInput.imagePaths,
    tags: session.draftInput.tags
  });
}

async function createVideoDraft(client: Client, session: DouyinSmokeSessionRecord) {
  return callJsonTool<PostDraftResult>(client, "create_video_post_draft", {
    platform: "douyin",
    title: session.draftInput.title,
    content: session.draftInput.content,
    video: session.draftInput.videoPath,
    ...(session.draftInput.coverImagePath
      ? {
          coverImage: session.draftInput.coverImagePath,
          coverOrientation: session.draftInput.coverOrientation
        }
      : {}),
    tags: session.draftInput.tags
  });
}

async function pollLoginStatus(client: Client, workspaceRoot: string, sessionId: string): Promise<LoginStatusResult> {
  const initial = requireSession(workspaceRoot, sessionId);
  for (let attempt = 1; attempt <= initial.settings.pollAttempts; attempt += 1) {
    const session = requireSession(workspaceRoot, sessionId);
    if (session.stopRequested) {
      return {
        platform: "douyin",
        loggedIn: false,
        message: "Stop requested while waiting for login."
      };
    }

    await sleep(5_000);
    const status = await checkLoginStatus(client);
    persist(workspaceRoot, {
      ...requireSession(workspaceRoot, sessionId),
      lastResult: { attempt, status },
      message: status.message
    });

    if (status.loggedIn) {
      return status;
    }
  }

  return checkLoginStatus(client);
}

async function waitForVerificationCode(workspaceRoot: string, sessionId: string): Promise<string | null> {
  while (true) {
    const session = requireSession(workspaceRoot, sessionId);
    if (session.stopRequested) {
      return null;
    }

    if (session.verificationCode) {
      return session.verificationCode;
    }

    await sleep(1_000);
  }
}

async function waitUntilStopRequested(workspaceRoot: string, sessionId: string): Promise<void> {
  while (true) {
    const session = requireSession(workspaceRoot, sessionId);
    if (session.stopRequested) {
      persist(workspaceRoot, {
        ...session,
        status: session.status === "completed" ? "completed" : "stopped",
        message: session.status === "completed" ? session.message : "Session stopped."
      });
      return;
    }

    await sleep(1_000);
  }
}

function resolveTsxEntrypoint(workspaceRoot: string): string {
  return `${workspaceRoot}/node_modules/tsx/dist/cli.mjs`;
}

function resolveDouyinScriptEntrypoint(workspaceRoot: string): string {
  return `${workspaceRoot}/scripts/smoke-douyin-draft.ts`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
