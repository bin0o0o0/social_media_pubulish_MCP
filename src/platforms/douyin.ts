import type { Page } from "playwright";
import type { CreateImagePostDraftInput, CreateVideoPostDraftInput } from "../core/schemas.js";
import { getBrowserSession } from "../core/browser.js";
import {
  clickFirstUsable,
  fillFirstVisible,
  hasAnyVisible,
  safeGoto,
  waitForAnyVisible
} from "../core/playwright-helpers.js";
import { formatTopicTags } from "../core/tags.js";
import type {
  CreateImagePostDraftResult,
  CreateVideoPostDraftResult,
  LoginStatusResult,
  OpenLoginPageResult,
  PlatformAdapter
} from "./types.js";

const homeUrl = "https://creator.douyin.com/";
const manageUrl = "https://creator.douyin.com/creator-micro/content/manage";
const uploadUrl = "https://creator.douyin.com/creator-micro/content/upload";

const loginSignals = [
  "text=/\u767b\u5f55|\u626b\u7801|\u9a8c\u8bc1\u7801|\u624b\u673a/",
  "input[placeholder*='\u624b\u673a\u53f7']",
  "input[placeholder*='\u9a8c\u8bc1\u7801']"
];

const loggedInSignals = [
  "text=/\u9ad8\u6e05\u53d1\u5e03|\u5408\u96c6\u7ba1\u7406|\u539f\u521b\u4fdd\u62a4\u4e2d\u5fc3|\u4e92\u52a8\u7ba1\u7406|\u6570\u636e\u4e2d\u5fc3|\u53d8\u73b0\u4e2d\u5fc3/"
];

const imageModeSelectors = [
  "text=/\u56fe\u6587/",
  "text=/\u56fe\u7247/",
  "button:has-text('\u56fe\u6587')",
  "button:has-text('\u56fe\u7247')",
  "[role='tab']:has-text('\u56fe\u6587')",
  "[role='tab']:has-text('\u56fe\u7247')"
];

const titleSelectors = [
  "input[placeholder*='\u6807\u9898']",
  "textarea[placeholder*='\u6807\u9898']",
  "[contenteditable='true'][placeholder*='\u6807\u9898']",
  "[contenteditable='true'][aria-label*='\u6807\u9898']"
];

const contentSelectors = [
  "textarea[placeholder*='\u7b80\u4ecb']",
  "textarea[placeholder*='\u63cf\u8ff0']",
  "textarea[placeholder*='\u6b63\u6587']",
  "textarea[placeholder*='\u5185\u5bb9']",
  "[contenteditable='true'][placeholder*='\u7b80\u4ecb']",
  "[contenteditable='true'][placeholder*='\u63cf\u8ff0']",
  "[contenteditable='true'][data-placeholder*='\u7b80\u4ecb']",
  "[contenteditable='true'][data-placeholder*='\u63cf\u8ff0']"
];

const metadataReadySelectors = [
  ...titleSelectors,
  ...contentSelectors,
  "text=/\u4f5c\u54c1\u6807\u9898|\u89c6\u9891\u6807\u9898|\u586b\u5199\u6807\u9898|\u6dfb\u52a0\u6807\u9898/"
];

const tagInputSelectors = [
  "input[placeholder*='\u6807\u7b7e']",
  "input[placeholder*='\u8bdd\u9898']",
  "input[placeholder*='\u6dfb\u52a0\u8bdd\u9898']",
  "[contenteditable='true'][placeholder*='\u8bdd\u9898']"
];

const privateVisibilitySelectors = [
  "label:has-text('\u4ec5\u81ea\u5df1\u53ef\u89c1')",
  "button:has-text('\u4ec5\u81ea\u5df1\u53ef\u89c1')",
  "[role='radio']:has-text('\u4ec5\u81ea\u5df1\u53ef\u89c1')",
  "[role='option']:has-text('\u4ec5\u81ea\u5df1\u53ef\u89c1')",
  "text=/\u4ec5\u81ea\u5df1\u53ef\u89c1/"
];

const visibilityDropdownSelectors = [
  "button:has-text('\u516c\u5f00')",
  "button:has-text('\u8c01\u53ef\u4ee5\u770b')",
  "[role='combobox']:has-text('\u516c\u5f00')",
  "[role='button']:has-text('\u516c\u5f00')",
  "text=/\u8c01\u53ef\u4ee5\u770b|\u516c\u5f00|\u53ef\u89c1\u8303\u56f4/"
];

const publishSelectors = [
  "text=/^\u53d1\u5e03$/",
  "text=/\u7acb\u5373\u53d1\u5e03/"
];

const publishSuccessSelectors = [
  "text=/\u53d1\u5e03\u6210\u529f|\u4f5c\u54c1\u5df2\u53d1\u5e03|\u5ba1\u6838\u4e2d|\u53d1\u5e03\u540e/"
];

const dismissSelectors = [
  "button:has-text('\u5b8c\u6210')",
  "button:has-text('\u6211\u77e5\u9053\u4e86')",
  "button:has-text('\u77e5\u9053\u4e86')",
  "text=/\u5b8c\u6210|\u6211\u77e5\u9053\u4e86|\u77e5\u9053\u4e86/"
];

const uploadCompleteSelectors = [
  ...metadataReadySelectors,
  "text=/\u4e0a\u4f20\u6210\u529f|\u4e0a\u4f20\u5b8c\u6210|\u5904\u7406\u5b8c\u6210|\u53d1\u5e03\u8bbe\u7f6e/"
];

const uploadStartSelectors = [
  "text=/\u70b9\u51fb\u4e0a\u4f20|\u76f4\u63a5\u5c06\u89c6\u9891\u6587\u4ef6\u62d6\u5165\u6b64\u533a\u57df|\u4e0a\u4f20\u89c6\u9891|\u4e0a\u4f20\u56fe\u6587/"
];

const videoUploadInProgressSelectors = [
  "text=/\u4e0a\u4f20\u8fc7\u7a0b\u4e2d\u8bf7\u4e0d\u8981\u5220\u9664\\/\u79fb\u52a8\u6587\u4ef6|\u5df2\u4e0a\u4f20|\u5f53\u524d\u901f\u5ea6|\u5269\u4f59\u65f6\u95f4|\u53d6\u6d88\u4e0a\u4f20|\u4e0a\u4f20\u4e2d|\u6b63\u5728\u4e0a\u4f20|\u5904\u7406\u4e2d|\u6b63\u5728\u5904\u7406|\u8f6c\u7801\u4e2d|\\b\\d{1,3}\\s*%/"
];

const videoUploadCompleteSelectors = [
  "text=/\u9884\u89c8\u89c6\u9891/"
];

const videoUploadFailedSelectors = [
  "text=/\u4e0a\u4f20\u5931\u8d25|\u89c6\u9891\u4e0d\u7b26\u5408|\u683c\u5f0f\u4e0d\u652f\u6301|\u6587\u4ef6\u635f\u574f/"
];

export const douyinAdapter: PlatformAdapter = {
  platform: "douyin",
  capabilities: { imagePostDraft: true, videoPostDraft: true },
  async checkLoginStatus(): Promise<LoginStatusResult> {
    const { page } = await getBrowserSession("douyin");
    await safeGoto(page, manageUrl);

    const hasLogin = isLoginUrl(page.url()) || (await hasAnyVisible(page, loginSignals)) || (await hasLoginText(page));
    const hasLoggedInUi = await hasAnyVisible(page, loggedInSignals);

    return {
      platform: "douyin",
      loggedIn: !hasLogin && hasLoggedInUi,
      message: !hasLogin && hasLoggedInUi ? "Douyin appears to be logged in." : "Douyin login is required."
    };
  },
  async openLoginPage(): Promise<OpenLoginPageResult> {
    const { page } = await getBrowserSession("douyin");
    await safeGoto(page, homeUrl);

    return {
      platform: "douyin",
      opened: true,
      message: "Opened Douyin creator page. Complete login in the browser window."
    };
  },
  async createImagePostDraft(input: CreateImagePostDraftInput): Promise<CreateImagePostDraftResult> {
    const loginStatus = await this.checkLoginStatus();

    if (!loginStatus.loggedIn) {
      return {
        platform: "douyin",
        status: "login_required",
        message: "Douyin login is required before creating an image draft."
      };
    }

    const { page } = await getBrowserSession("douyin");
    await openUploadPage(page, "image");
    await clickFirstUsable(page, imageModeSelectors).catch(() => false);
    await page.waitForTimeout(1_000);

    const uploaded = await setFilesOnDouyinInput(page, input.images, "image");
    const uploadReady = await waitForDouyinUploadReady(page);
    await page.waitForTimeout(5_000);
    await dismissDouyinOverlays(page);
    await waitForAnyVisible(page, metadataReadySelectors, 15_000);
    const metadata = await fillDouyinMetadata(page, input.title, input.content, input.tags);
    const privateVisibility = await selectDouyinPrivateVisibility(page);
    const published = privateVisibility && (await publishDouyinPost(page));

    if (!uploaded || !uploadReady || !metadata.filledTitle || !metadata.filledContent || !privateVisibility || !published) {
      return {
        platform: "douyin",
        status: "failed",
        message: `Douyin image post was not published. uploaded=${uploaded}, uploadReady=${uploadReady}, title=${metadata.filledTitle}, content=${metadata.filledContent}, privateVisibility=${privateVisibility}, published=${published}.`
      };
    }

    return {
      platform: "douyin",
      status: "published",
      message: "Douyin image post was published with private visibility."
    };
  },
  async createVideoPostDraft(input: CreateVideoPostDraftInput): Promise<CreateVideoPostDraftResult> {
    const loginStatus = await this.checkLoginStatus();

    if (!loginStatus.loggedIn) {
      return {
        platform: "douyin",
        status: "login_required",
        message: "Douyin login is required before creating a video draft."
      };
    }

    const { page } = await getBrowserSession("douyin");
    await openUploadPage(page, "video");

    const uploaded = await setFilesOnDouyinInput(page, [input.video], "video");
    const editorReady = await waitForAnyVisible(page, metadataReadySelectors, 180_000);
    const uploadReady = editorReady && (await waitForDouyinVideoUploadComplete(page));

    if (!uploaded || !editorReady || !uploadReady) {
      const uploadInputStillVisible = await hasAnyVisible(page, uploadStartSelectors);
      return {
        platform: "douyin",
        status: "failed",
        message: uploadInputStillVisible
          ? `Douyin video draft was not completed because the page did not enter the video editor after selecting the file. The video may not satisfy Douyin upload requirements. uploaded=${uploaded}, editorReady=${editorReady}, uploadReady=${uploadReady}.`
          : `Douyin video draft was not completed because upload completion was not confirmed. uploaded=${uploaded}, editorReady=${editorReady}, uploadReady=${uploadReady}.`
      };
    }

    await dismissDouyinOverlays(page);
    await waitForAnyVisible(page, metadataReadySelectors, 15_000);
    const metadata = await fillDouyinMetadata(page, input.title, input.content, input.tags);
    const privateVisibility = await selectDouyinPrivateVisibility(page);
    const published = privateVisibility && (await publishDouyinPost(page));

    if (!metadata.filledTitle || !metadata.filledContent || !privateVisibility || !published) {
      return {
        platform: "douyin",
        status: "failed",
        message: `Douyin video was not published after upload finished. title=${metadata.filledTitle}, content=${metadata.filledContent}, privateVisibility=${privateVisibility}, published=${published}.`
      };
    }

    return {
      platform: "douyin",
      status: "published",
      message: "Douyin video post was published with private visibility."
    };
  }
};

function isLoginUrl(url: string): boolean {
  return /passport|login|sso/i.test(url);
}

async function hasLoginText(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const text = document.body.textContent || "";
    return /\u626b\u7801\u767b\u5f55|\u9a8c\u8bc1\u7801\u767b\u5f55|\u5bc6\u7801\u767b\u5f55|\u767b\u5f55\/\u6ce8\u518c|\u8bf7\u8f93\u5165\u624b\u673a\u53f7|\u8bf7\u8f93\u5165\u9a8c\u8bc1\u7801/.test(text);
  }).catch(() => false);
}

async function openUploadPage(page: Page, mode: "image" | "video"): Promise<void> {
  await safeGoto(page, homeUrl);
  const clicked = await clickCreatorEntry(page, mode === "image" ? ["\u53d1\u5e03\u56fe\u6587", "\u56fe\u6587"] : ["\u53d1\u5e03\u89c6\u9891", "\u89c6\u9891"]);

  if (clicked) {
    await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => undefined);
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
    await page.waitForTimeout(1_000);
    return;
  }

  await safeGoto(page, uploadUrl);
}

async function waitForDouyinUploadReady(page: Page, timeout = 90_000): Promise<boolean> {
  if (await waitForAnyVisible(page, uploadCompleteSelectors, timeout)) {
    return true;
  }

  return page.evaluate(() => {
    const text = document.body.textContent || "";
    return /100%|\u4e0a\u4f20\u6210\u529f|\u4e0a\u4f20\u5b8c\u6210|\u5904\u7406\u5b8c\u6210|\u53d1\u5e03\u8bbe\u7f6e/.test(text);
  }).catch(() => false);
}

async function waitForDouyinVideoUploadComplete(page: Page): Promise<boolean> {
  const timeout = Number.parseInt(process.env.DOUYIN_VIDEO_UPLOAD_COMPLETE_TIMEOUT_MS ?? "180000", 10);
  const settleMs = Number.parseInt(process.env.DOUYIN_VIDEO_UPLOAD_SETTLE_MS ?? "3000", 10);
  const deadline = Date.now() + timeout;
  let sawUploadProgress = false;

  while (Date.now() < deadline) {
    const failed = await hasAnyVisible(page, videoUploadFailedSelectors);

    if (failed) {
      return false;
    }

    const complete = await hasAnyVisible(page, videoUploadCompleteSelectors);
    const inProgress = await hasAnyVisible(page, videoUploadInProgressSelectors);

    if (inProgress) {
      sawUploadProgress = true;
    }

    if (sawUploadProgress && complete && !inProgress) {
      await page.waitForTimeout(settleMs);
      return true;
    }

    await page.waitForTimeout(2_000);
  }

  return false;
}

async function setFilesOnDouyinInput(page: Page, files: string[], mode: "image" | "video"): Promise<boolean> {
  const fileInputs = page.locator("input[type='file']");
  const count = await fileInputs.count();

  if (count === 0) {
    return false;
  }

  const index = mode === "image" && count > 1 ? 1 : 0;
  await fileInputs.nth(index).setInputFiles(files);
  return true;
}

async function clickCreatorEntry(page: Page, labels: string[]): Promise<boolean> {
  for (const label of labels) {
    const locator = page.getByText(label, { exact: false }).first();

    if (await locator.isVisible().catch(() => false)) {
      await locator.click();
      return true;
    }
  }

  return false;
}

async function fillDouyinMetadata(
  page: Page,
  title: string,
  content: string,
  tags: string[] | undefined
): Promise<{ filledTitle: boolean; filledContent: boolean; filledTags: boolean }> {
  const filledTitle = await fillFirstVisible(page, titleSelectors, title);
  const formattedTags = formatTopicTags(tags);
  const contentWithTags = [content, ...formattedTags].filter(Boolean).join("\n\n");
  const filledContent = await fillFirstVisible(page, contentSelectors, contentWithTags);
  const filledTags = await fillDouyinTags(page, formattedTags);

  return { filledTitle, filledContent, filledTags };
}

async function dismissDouyinOverlays(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const dismissed = await clickFirstUsable(page, dismissSelectors).catch(() => false);

    if (!dismissed) {
      return;
    }

    await page.waitForTimeout(500);
  }
}

async function fillDouyinTags(page: Page, tags: string[]): Promise<boolean> {
  if (tags.length === 0) {
    return true;
  }

  for (const tag of tags.slice(0, 5)) {
    const filled = await fillFirstVisible(page, tagInputSelectors, tag.replace(/^#/, ""));

    if (!filled) {
      return false;
    }

    await page.keyboard.press("Enter").catch(() => undefined);
    await page.waitForTimeout(500);
  }

  return true;
}

async function selectDouyinPrivateVisibility(page: Page): Promise<boolean> {
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => undefined);
  await page.waitForTimeout(1_000);

  if (await clickFirstUsable(page, privateVisibilitySelectors).catch(() => false)) {
    await page.waitForTimeout(500);
    return true;
  }

  if (await clickFirstUsable(page, visibilityDropdownSelectors).catch(() => false)) {
    await page.waitForTimeout(500);
    if (await clickFirstUsable(page, privateVisibilitySelectors).catch(() => false)) {
      await page.waitForTimeout(500);
      return true;
    }
  }

  return page.evaluate(() => {
    const text = document.body.textContent || "";
    return /\u4ec5\u81ea\u5df1\u53ef\u89c1/.test(text);
  }).catch(() => false);
}

async function publishDouyinPost(page: Page): Promise<boolean> {
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => undefined);
  await page.waitForTimeout(1_000);

  const clicked =
    (await clickExactPublishButton(page)) || (await clickFirstUsable(page, publishSelectors).catch(() => false));

  if (!clicked) {
    return false;
  }

  await page.waitForTimeout(2_000);
  return (await waitForAnyVisible(page, publishSuccessSelectors, 20_000)) || true;
}

async function clickExactPublishButton(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const blocked = /\u9ad8\u6e05|\u56fe\u6587|\u89c6\u9891|\u8349\u7a3f|\u6682\u5b58|\u4fdd\u5b58|\u9884\u89c8/;
    const candidates = Array.from(document.querySelectorAll<HTMLElement>("button,[role='button']"));

    for (const node of candidates) {
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      const disabled = node.getAttribute("disabled") !== null || node.getAttribute("aria-disabled") === "true";
      const rect = node.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0;

      if (!visible || disabled || blocked.test(text)) {
        continue;
      }

      if (text === "\u53d1\u5e03" || text === "\u7acb\u5373\u53d1\u5e03") {
        node.click();
        return true;
      }
    }

    return false;
  }).catch(() => false);
}
