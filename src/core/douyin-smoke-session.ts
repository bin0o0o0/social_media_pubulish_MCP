import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type DouyinSmokeSessionMode = "image" | "video";

export type DouyinSmokeSessionStatus =
  | "created"
  | "running"
  | "awaiting_verification"
  | "verified"
  | "completed"
  | "failed"
  | "stopped";

export type DouyinSmokeSessionRecord = {
  sessionId: string;
  profileSuffix: string | null;
  mode: DouyinSmokeSessionMode;
  draftInput: {
    title: string;
    content: string;
    imagePaths: string[];
    videoPath: string | null;
    coverImagePath: string | null;
    coverOrientation: "vertical" | "horizontal";
    tags: string[];
  };
  settings: {
    autoOpenLogin: boolean;
    pollAttempts: number;
    loginInitialWaitMs: number;
  };
  status: DouyinSmokeSessionStatus;
  createdAt: string;
  updatedAt: string;
  verificationCode: string | null;
  workerPid: number | null;
  message: string | null;
  lastResult: Record<string, unknown> | null;
  stopRequested: boolean;
};

export function getDouyinSmokeSessionDirectory(workspaceRoot = process.cwd()): string {
  return join(workspaceRoot, ".social-media-mcp", "douyin-smoke-sessions");
}

export function getDouyinSmokeSessionFilePath(workspaceRoot: string, sessionId: string): string {
  return join(getDouyinSmokeSessionDirectory(workspaceRoot), `${sessionId}.json`);
}

export function createDouyinSmokeSessionRecord(input: {
  sessionId: string;
  profileSuffix: string | null;
  mode: DouyinSmokeSessionMode;
  draftInput: DouyinSmokeSessionRecord["draftInput"];
  settings: DouyinSmokeSessionRecord["settings"];
}): DouyinSmokeSessionRecord {
  const now = new Date().toISOString();
  return {
    sessionId: input.sessionId,
    profileSuffix: input.profileSuffix,
    mode: input.mode,
    draftInput: input.draftInput,
    settings: input.settings,
    status: "created",
    createdAt: now,
    updatedAt: now,
    verificationCode: null,
    workerPid: null,
    message: null,
    lastResult: null,
    stopRequested: false
  };
}

export function readDouyinSmokeSession(
  workspaceRoot: string,
  sessionId: string
): DouyinSmokeSessionRecord | null {
  const filePath = getDouyinSmokeSessionFilePath(workspaceRoot, sessionId);
  if (!existsSync(filePath)) {
    return null;
  }

  return JSON.parse(readFileSync(filePath, "utf8")) as DouyinSmokeSessionRecord;
}

export function updateDouyinSmokeSession(
  workspaceRoot: string,
  record: DouyinSmokeSessionRecord
): DouyinSmokeSessionRecord {
  const directory = getDouyinSmokeSessionDirectory(workspaceRoot);
  mkdirSync(directory, { recursive: true });

  const updated: DouyinSmokeSessionRecord = {
    ...record,
    updatedAt: new Date().toISOString()
  };

  writeFileSync(getDouyinSmokeSessionFilePath(workspaceRoot, updated.sessionId), `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  return updated;
}

export function attachVerificationCodeToSession(
  record: DouyinSmokeSessionRecord,
  verificationCode: string
): DouyinSmokeSessionRecord {
  return {
    ...record,
    verificationCode
  };
}

export function markDouyinSmokeSessionStopRequested(
  record: DouyinSmokeSessionRecord
): DouyinSmokeSessionRecord {
  return {
    ...record,
    stopRequested: true
  };
}
