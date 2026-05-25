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
  "text=/登录|扫码|验证码|手机/",
  "input[placeholder*='手机号']",
  "input[placeholder*='验证码']"
];

const loggedInSignals = [
  "text=/高清发布|合集管理|原创保护中心|互动管理|数据中心|变现中心/"
];

const imageModeSelectors = [
  "text=/图文/",
  "text=/图片/",
  "button:has-text('图文')",
  "button:has-text('图片')",
  "[role='tab']:has-text('图文')",
  "[role='tab']:has-text('图片')"
];

const titleSelectors = [
  "input[placeholder*='标题']",
  "textarea[placeholder*='标题']",
  "[contenteditable='true'][placeholder*='标题']",
  "[contenteditable='true'][aria-label*='标题']"
];

const contentSelectors = [
  "textarea[placeholder*='简介']",
  "textarea[placeholder*='描述']",
  "textarea[placeholder*='正文']",
  "textarea[placeholder*='内容']",
  "[contenteditable='true'][placeholder*='简介']",
  "[contenteditable='true'][placeholder*='描述']",
  "[contenteditable='true'][data-placeholder*='简介']",
  "[contenteditable='true'][data-placeholder*='描述']"
];

const metadataReadySelectors = [
  ...titleSelectors,
  ...contentSelectors,
  "text=/作品标题|视频标题|填写标题|添加标题/"
];

const tagInputSelectors = [
  "input[placeholder*='标签']",
  "input[placeholder*='话题']",
  "input[placeholder*='添加话题']",
  "[contenteditable='true'][placeholder*='话题']"
];

const draftSelectors = [
  "button:has-text('保存草稿')",
  "button:has-text('存草稿')",
  "button:has-text('暂存')",
  "text=/保存草稿|存草稿|暂存/"
];

const dismissSelectors = [
  "button:has-text('完成')",
  "button:has-text('我知道了')",
  "button:has-text('知道了')",
  "text=/完成|我知道了|知道了/"
];

const uploadCompleteSelectors = [
  ...metadataReadySelectors,
  "text=/上传成功|上传完成|处理完成|发布设置/"
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
      message: !hasLogin && hasLoggedInUi
        ? "Douyin appears to be logged in."
        : "Douyin login is required."
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
    const savedDraft = await saveDouyinDraft(page);

    if (!uploaded || !uploadReady || !metadata.filledTitle || !metadata.filledContent || !savedDraft) {
      return {
        platform: "douyin",
        status: "failed",
        message: `Douyin image draft was not completed. uploaded=${uploaded}, uploadReady=${uploadReady}, title=${metadata.filledTitle}, content=${metadata.filledContent}, savedDraft=${savedDraft}.`
      };
    }

    return {
      platform: "douyin",
      status: "draft_created",
      message: "Douyin image post draft was created."
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
    const uploadReady = await waitForDouyinUploadReady(page, 180_000);
    await page.waitForTimeout(5_000);
    await dismissDouyinOverlays(page);
    await waitForAnyVisible(page, metadataReadySelectors, 15_000);
    const metadata = await fillDouyinMetadata(page, input.title, input.content, input.tags);
    const savedDraft = await saveDouyinDraft(page);

    if (!uploaded || !uploadReady || !metadata.filledTitle || !metadata.filledContent || !savedDraft) {
      return {
        platform: "douyin",
        status: "failed",
        message: `Douyin video draft was not completed. uploaded=${uploaded}, uploadReady=${uploadReady}, title=${metadata.filledTitle}, content=${metadata.filledContent}, savedDraft=${savedDraft}.`
      };
    }

    return {
      platform: "douyin",
      status: "draft_created",
      message: "Douyin video post draft was created."
    };
  }
};

function isLoginUrl(url: string): boolean {
  return /passport|login|sso/i.test(url);
}

async function hasLoginText(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const text = document.body.textContent || "";
    return /扫码登录|验证码登录|密码登录|登录\/注册|请输入手机号|请输入验证码/.test(text);
  }).catch(() => false);
}

async function openUploadPage(page: Page, mode: "image" | "video"): Promise<void> {
  await safeGoto(page, uploadUrl);

  if (await hasFileInput(page)) {
    return;
  }

  await safeGoto(page, homeUrl);
  const clicked = await clickCreatorEntry(page, mode === "image" ? ["发布图文", "图文"] : ["发布视频", "视频"]);

  if (clicked) {
    await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => undefined);
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
    await page.waitForTimeout(1_000);
  }
}

async function waitForDouyinUploadReady(page: Page, timeout = 90_000): Promise<boolean> {
  const visible = await waitForAnyVisible(page, uploadCompleteSelectors, timeout);

  if (visible) {
    return true;
  }

  return page.evaluate(() => {
    const text = document.body.textContent || "";
    return /100%|上传成功|上传完成|处理完成|发布设置/.test(text);
  }).catch(() => false);
}

async function hasFileInput(page: Page): Promise<boolean> {
  return (await page.locator("input[type='file']").count()) > 0;
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
    const visible = await locator.isVisible().catch(() => false);

    if (visible) {
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

async function saveDouyinDraft(page: Page): Promise<boolean> {
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => undefined);
  await page.waitForTimeout(1_000);
  return clickFirstUsable(page, draftSelectors);
}
