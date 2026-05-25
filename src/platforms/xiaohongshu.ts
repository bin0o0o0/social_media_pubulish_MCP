import type { CreateImagePostDraftInput } from "../core/schemas.js";
import { getBrowserSession } from "../core/browser.js";
import {
  hasAnyVisible,
  safeGoto,
  setFilesOnFirstInput
} from "../core/playwright-helpers.js";
import { formatTopicTags } from "../core/tags.js";
import type {
  CreateImagePostDraftResult,
  LoginStatusResult,
  OpenLoginPageResult,
  PlatformAdapter
} from "./types.js";

const homeUrl = "https://creator.xiaohongshu.com/";
const publishUrl = "https://creator.xiaohongshu.com/publish/publish?from=menu&target=image";

const loginSignals = [
  "text=/登录|扫码|验证码/",
  "input[placeholder*='手机号']",
  "input[placeholder*='验证码']"
];

const loggedInSignals = [
  "text=/发布|创作|笔记|数据/",
  "[class*='avatar']",
  "[class*='user']"
];

export const xiaohongshuAdapter: PlatformAdapter = {
  platform: "xiaohongshu",
  capabilities: { imagePostDraft: true },
  async checkLoginStatus(): Promise<LoginStatusResult> {
    const { page } = await getBrowserSession("xiaohongshu");
    await safeGoto(page, homeUrl);

    const hasLogin = await hasAnyVisible(page, loginSignals);
    const hasLoggedInUi = await hasAnyVisible(page, loggedInSignals);

    return {
      platform: "xiaohongshu",
      loggedIn: hasLoggedInUi && !hasLogin,
      message: hasLoggedInUi && !hasLogin ? "Xiaohongshu appears to be logged in." : "Xiaohongshu login is required."
    };
  },
  async openLoginPage(): Promise<OpenLoginPageResult> {
    const { page } = await getBrowserSession("xiaohongshu");
    await safeGoto(page, homeUrl);

    return {
      platform: "xiaohongshu",
      opened: true,
      message: "Opened Xiaohongshu creator page. Complete login in the browser window."
    };
  },
  async createImagePostDraft(input: CreateImagePostDraftInput): Promise<CreateImagePostDraftResult> {
    const loginStatus = await this.checkLoginStatus();

    if (!loginStatus.loggedIn) {
      return {
        platform: "xiaohongshu",
        status: "login_required",
        message: "Xiaohongshu login is required before creating a draft."
      };
    }

    const { page } = await getBrowserSession("xiaohongshu");
    await safeGoto(page, publishUrl);

    const uploaded = await setFilesOnFirstInput(page, input.images);
    await page.waitForTimeout(6_000);
    const titleInput = page.locator("input.d-text").first();
    const contentEditor = page.locator("[role='textbox']").first();
    await titleInput.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
    await contentEditor.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
    const filledTitle = await titleInput
      .fill(input.title)
      .then(() => true)
      .catch(() => false);
    const contentWithTags = [input.content, ...formatTopicTags(input.tags)].filter(Boolean).join("\n\n");
    const filledContent = await contentEditor
      .fill(contentWithTags)
      .then(() => true)
      .catch(() => false);
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(1_000);
    const savedDraft = await page
      .locator("xhs-publish-btn")
      .evaluate(async (node: Element & { _onSave?: () => Promise<unknown> | unknown }) => {
        if (typeof node._onSave !== "function") {
          return false;
        }

        const result = node._onSave();

        if (result && typeof (result as Promise<unknown>).then === "function") {
          await result;
        }

        return true;
      })
      .catch(() => false);

    if (!uploaded || !filledTitle || !filledContent || !savedDraft) {
      return {
        platform: "xiaohongshu",
        status: "failed",
        message: `Xiaohongshu draft was not completed. uploaded=${uploaded}, title=${filledTitle}, content=${filledContent}, savedDraft=${savedDraft}.`
      };
    }

    return {
      platform: "xiaohongshu",
      status: "draft_created",
      message: "Xiaohongshu image post draft was created."
    };
  }
};
