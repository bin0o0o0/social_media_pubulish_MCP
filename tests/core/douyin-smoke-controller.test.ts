import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  startDouyinSmokeSession,
  type DouyinSmokeWorkerProcess
} from "../../src/core/douyin-smoke-controller.js";
import { createDouyinSmokeSessionRecord, updateDouyinSmokeSession } from "../../src/core/douyin-smoke-session.js";

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

describe("startDouyinSmokeSession", () => {
  test("reuses an active session for the same profile instead of spawning another worker", () => {
    const workspace = mkdtempSync(join(tmpdir(), "douyin-smoke-controller-"));

    try {
      const existing = updateDouyinSmokeSession(workspace, {
        ...createDouyinSmokeSessionRecord({
          sessionId: "douyin-existing",
          profileSuffix: "douyin-live3",
          mode: "image",
          draftInput: sampleDraftInput(),
          settings: sampleSettings()
        }),
        status: "running",
        workerPid: 12345,
        message: "Worker connected to the local MCP server."
      });

      let spawnCalled = false;
      const record = startDouyinSmokeSession(
        {
          workspaceRoot: workspace,
          profileSuffix: "douyin-live3",
          mode: "image",
          draftInput: sampleDraftInput(),
          settings: sampleSettings()
        },
        {
          isProcessAlive: (pid) => pid === existing.workerPid,
          spawnWorker: () => {
            spawnCalled = true;
            return { pid: 67890, unref() {} } satisfies DouyinSmokeWorkerProcess;
          }
        }
      );

      expect(record).toMatchObject({
        sessionId: "douyin-existing",
        profileSuffix: "douyin-live3",
        status: "running",
        workerPid: 12345,
        message: "Reusing active Douyin smoke session for profile douyin-live3."
      });
      expect(spawnCalled).toBe(false);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
