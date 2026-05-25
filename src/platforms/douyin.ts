import type { CreateImagePostDraftInput } from "../core/schemas.js";
import { getBrowserSession } from "../core/browser.js";
import { clickFirstVisible, fillFirstVisible, hasAnyVisible, safeGoto, setFilesOnFirstInput } from "../core/playwright-helpers.js";
import { formatTopicTags } from "../core/tags.js";
import type {
  CreateImagePostDraftResult,
  LoginStatusResult,
  OpenLoginPageResult,
  PlatformAdapter
} from "./types.js";

const homeUrl = "https://creator.douyin.com/";
const publishUrl = "https://creator.douyin.com/creator-micro/content/upload";

const loginSignals = [
  "text=/登录|扫码|验证码/",
  "input[placeholder*='手机号']",
  "input[placeholder*='验证码']"
];

const loggedInSignals = [
  "text=/发布视频|发布作品|创作服务|内容管理|图文/",
  "[class*='avatar']",
  "[class*='user']"
];

const imagePostSelectors = ["text=/图文|图片|发布图文/"];
const titleSelectors = [
  "input[placeholder*='标题']",
  "textarea[placeholder*='标题']",
  "[contenteditable='true'][placeholder*='标题']"
];
const contentSelectors = [
  "textarea[placeholder*='简介']",
  "textarea[placeholder*='描述']",
  "textarea[placeholder*='正文']",
  "textarea[placeholder*='内容']",
  "[contenteditable='true']"
];
const draftSelectors = ["text=/保存草稿|存草稿|暂存/"];

export const douyinAdapter: PlatformAdapter = {
  platform: "douyin",
  async checkLoginStatus(): Promise<LoginStatusResult> {
    const { page } = await getBrowserSession("douyin");
    await safeGoto(page, homeUrl);

    const hasLogin = await hasAnyVisible(page, loginSignals);
    const hasLoggedInUi = await hasAnyVisible(page, loggedInSignals);

    return {
      platform: "douyin",
      loggedIn: hasLoggedInUi && !hasLogin,
      message: hasLoggedInUi && !hasLogin ? "Douyin appears to be logged in." : "Douyin login is required."
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
        message: "Douyin login is required before creating a draft."
      };
    }

    const { page } = await getBrowserSession("douyin");
    await safeGoto(page, publishUrl);
    await clickFirstVisible(page, imagePostSelectors).catch(() => false);

    const uploaded = await setFilesOnFirstInput(page, input.images);
    const filledTitle = await fillFirstVisible(page, titleSelectors, input.title);
    const contentWithTags = [input.content, ...formatTopicTags(input.tags)].filter(Boolean).join("\n\n");
    const filledContent = await fillFirstVisible(page, contentSelectors, contentWithTags);
    const savedDraft = await clickFirstVisible(page, draftSelectors);

    if (!uploaded || !filledTitle || !filledContent || !savedDraft) {
      return {
        platform: "douyin",
        status: "failed",
        message: `Douyin draft was not completed. uploaded=${uploaded}, title=${filledTitle}, content=${filledContent}, savedDraft=${savedDraft}.`
      };
    }

    return {
      platform: "douyin",
      status: "draft_created",
      message: "Douyin image post draft was created."
    };
  }
};
