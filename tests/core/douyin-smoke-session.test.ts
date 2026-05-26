import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, normalize } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import {
  attachVerificationCodeToSession,
  createDouyinSmokeSessionRecord,
  getDouyinSmokeSessionDirectory,
  getDouyinSmokeSessionFilePath,
  markDouyinSmokeSessionStopRequested,
  readDouyinSmokeSession,
  updateDouyinSmokeSession
} from "../../src/core/douyin-smoke-session.js";

function sampleDraftInput() {
  return {
    title: "douyin title",
    content: "douyin content",
    imagePaths: ["D:/tmp/test.png"],
    videoPath: null,
    coverImagePath: null,
    coverOrientation: "vertical" as const,
    tags: ["mcp"]
  };
}

function sampleSettings() {
  return {
    autoOpenLogin: true,
    pollAttempts: 60,
    loginInitialWaitMs: 0
  };
}

describe("douyin smoke session state", () => {
  test("builds a stable session directory inside .social-media-mcp", () => {
    const root = "D:/workspace/social-media";
    expect(normalize(getDouyinSmokeSessionDirectory(root))).toBe(
      normalize("D:/workspace/social-media/.social-media-mcp/douyin-smoke-sessions")
    );
  });

  test("creates a session record ready for long-lived verification flow", () => {
    const session = createDouyinSmokeSessionRecord({
      sessionId: "douyin-session-1",
      profileSuffix: "douyin-live3",
      mode: "image",
      draftInput: sampleDraftInput(),
      settings: sampleSettings()
    });

    expect(session).toMatchObject({
      sessionId: "douyin-session-1",
      profileSuffix: "douyin-live3",
      mode: "image",
      status: "created",
      verificationCode: null,
      draftInput: {
        coverImagePath: null,
        coverOrientation: "vertical"
      }
    });
    expect(typeof session.createdAt).toBe("string");
    expect(typeof session.updatedAt).toBe("string");
  });

  test("persists and reloads session updates from disk", () => {
    const workspace = mkdtempSync(join(tmpdir(), "douyin-smoke-session-"));

    try {
      const sessionPath = getDouyinSmokeSessionFilePath(workspace, "douyin-session-2");
      updateDouyinSmokeSession(workspace, createDouyinSmokeSessionRecord({
        sessionId: "douyin-session-2",
        profileSuffix: "douyin-live3",
        mode: "image",
        draftInput: sampleDraftInput(),
        settings: sampleSettings()
      }));

      const loaded = readDouyinSmokeSession(workspace, "douyin-session-2");
      expect(loaded).not.toBeNull();
      expect(loaded).toMatchObject({
        sessionId: "douyin-session-2",
        status: "created"
      });

      updateDouyinSmokeSession(workspace, {
        ...loaded!,
        status: "awaiting_verification",
        verificationCode: "675221"
      });

      const updated = JSON.parse(readFileSync(sessionPath, "utf8")) as { status: string; verificationCode: string | null };
      expect(updated).toMatchObject({
        status: "awaiting_verification",
        verificationCode: "675221"
      });
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  test("attaches a verification code while preserving the session record", () => {
    const session = createDouyinSmokeSessionRecord({
      sessionId: "douyin-session-3",
      profileSuffix: "douyin-live3",
      mode: "image",
      draftInput: sampleDraftInput(),
      settings: sampleSettings()
    });

    const updated = attachVerificationCodeToSession({
      ...session,
      status: "awaiting_verification"
    }, "675221");

    expect(updated).toMatchObject({
      sessionId: "douyin-session-3",
      status: "awaiting_verification",
      verificationCode: "675221"
    });
  });

  test("marks a session as stop requested without losing verification state", () => {
    const session = createDouyinSmokeSessionRecord({
      sessionId: "douyin-session-4",
      profileSuffix: "douyin-live3",
      mode: "image",
      draftInput: sampleDraftInput(),
      settings: sampleSettings()
    });

    const updated = markDouyinSmokeSessionStopRequested({
      ...session,
      status: "awaiting_verification",
      verificationCode: "675221"
    });

    expect(updated).toMatchObject({
      sessionId: "douyin-session-4",
      status: "awaiting_verification",
      verificationCode: "675221",
      stopRequested: true
    });
  });
});
