import path from "node:path";
import type { Page } from "playwright";
import { replaceImageMarkers, setFileOnMatchingInput, waitForBodyPattern } from "../core/article-browser.js";
import type { CreateArticlePostDraftInput } from "../core/schemas.js";
import { getBrowserSession } from "../core/browser.js";
import { prepareMarkdownArticle } from "../core/markdown-article.js";
import { clickFirstUsable, fillFirstVisible, hasAnyVisible, safeGoto } from "../core/playwright-helpers.js";
import type { CreateArticlePostDraftResult, LoginStatusResult, OpenLoginPageResult, PlatformAdapter } from "./types.js";

const homeUrl = "https://www.zhihu.com/creator";
const editorUrl = "https://zhuanlan.zhihu.com/write";
const loginSignals = ["text=/登录|注册|验证码登录/", "input[placeholder*='手机号']"];
const loggedInSignals = ["text=/创作中心|内容管理|开始创作/", "[class*='Avatar']", "[class*='avatar']"];
const titleSelectors = ["textarea[placeholder*='标题']", "input[placeholder*='标题']", ".WriteIndex-titleInput"];
const editorSelectors = ["[contenteditable='true']", ".public-DraftEditor-content", ".ProseMirror", "textarea"];
const imageButtons = ["button[aria-label*='图片']", "button:has-text('图片')", "[title*='图片']"];

export const zhihuAdapter: PlatformAdapter = {
  platform: "zhihu",
  capabilities: { articlePostDraft: true },
  async checkLoginStatus(): Promise<LoginStatusResult> {
    const { page } = await getBrowserSession("zhihu");
    if (!isZhihuUrl(page.url())) {
      await safeGoto(page, homeUrl);
    }
    const hasLogin = await hasAnyVisible(page, loginSignals);
    const hasLoggedInUi = await hasAnyVisible(page, loggedInSignals);
    return {
      platform: "zhihu",
      loggedIn: hasLoggedInUi && !hasLogin,
      message: hasLoggedInUi && !hasLogin ? "Zhihu appears to be logged in." : "Zhihu login is required."
    };
  },
  async openLoginPage(): Promise<OpenLoginPageResult> {
    const { page } = await getBrowserSession("zhihu");
    if (!isZhihuUrl(page.url())) {
      await safeGoto(page, homeUrl);
    }
    return { platform: "zhihu", opened: true, message: "Opened Zhihu creator page. Complete login in the browser window." };
  },
  async createArticlePostDraft(input: CreateArticlePostDraftInput): Promise<CreateArticlePostDraftResult> {
    const login = await this.checkLoginStatus();
    if (!login.loggedIn) {
      return { platform: "zhihu", status: "login_required", message: "Zhihu login is required before creating a draft." };
    }

    const prepared = await prepareMarkdownArticle(input.markdownPath);
    try {
      const { page } = await getBrowserSession("zhihu");
      await safeGoto(page, editorUrl);
      const imported = await importZhihuMarkdown(page, prepared.normalizedMarkdownPath);
      const expectedContent = prepared.images[0]?.marker || prepared.plainText.slice(0, 40);
      const importedContent = imported && expectedContent.length > 0
        ? prepared.images.length > 0
          ? await waitForExactText(page, expectedContent, 60_000)
          : await waitForBodyPattern(page, new RegExp(escapeRegExp(expectedContent)), 60_000)
        : false;
      const titleFilled = await fillFirstVisible(page, titleSelectors, input.title);
      const imageResult = importedContent
        ? await replaceImageMarkers(page, editorSelectors, imageButtons, prepared.images, {
            uploadConfirmSelectors: ["button:has-text('插入图片')"],
            uploadReadyPattern: /已上传\s*1\s*张图片/
          })
        : { replaced: 0, failedMarker: prepared.images[0]?.marker };
      const warnings = [...prepared.warnings];
      if (input.tags?.length) {
        warnings.push("Zhihu topics are not applied until the editor exposes a stable draft-safe topic control.");
      }
      if (input.category) {
        warnings.push("Zhihu does not use the article category parameter.");
      }

      const saved = importedContent && titleFilled && !imageResult.failedMarker
        ? await waitForZhihuDraft(page, 30_000)
        : false;

      return saved
        ? { platform: "zhihu", status: "draft_created", message: "Zhihu article draft was created.", warnings }
        : {
            platform: "zhihu",
            status: "failed",
            message: `Zhihu draft was not completed. imported=${importedContent}, title=${titleFilled}, images=${imageResult.replaced}/${prepared.images.length}, saved=${saved}.`,
            warnings
          };
    } finally {
      await prepared.cleanup();
    }
  }
};

async function importZhihuMarkdown(page: Page, markdownPath: string): Promise<boolean> {
  const importMenuOpened = await clickFirstUsable(page, ["button:has-text('导入')", "[aria-label*='导入']"]).catch(() => false);
  if (!importMenuOpened) {
    return false;
  }

  await page.waitForTimeout(300);
  const importDocumentOpened = await clickFirstUsable(page, ["button:has-text('导入文档')", "text=导入文档"]).catch(() => false);
  if (!importDocumentOpened) {
    return false;
  }

  await page.waitForTimeout(300);
  const uploaded = await setFileOnMatchingInput(page, markdownPath, [".md", ".markdown", "text/markdown"]);
  if (!uploaded) {
    return false;
  }

  const fileName = path.basename(markdownPath);
  const fileLabel = page.getByText(fileName, { exact: true }).last();
  const fileLabelVisible = await fileLabel.waitFor({ state: "visible", timeout: 10_000 }).then(() => true).catch(() => false);
  if (fileLabelVisible) {
    await fileLabel.click({ force: true }).catch(() => undefined);
  }

  const addFile = page.getByText("添加文件", { exact: true }).last();
  const addFileVisible = await addFile.waitFor({ state: "visible", timeout: 5_000 }).then(() => true).catch(() => false);
  if (addFileVisible) {
    await addFile.click({ force: true }).catch(() => undefined);
  }

  return true;
}

async function waitForExactText(page: Page, text: string, timeout: number): Promise<boolean> {
  return page
    .getByText(text, { exact: true })
    .last()
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
}

async function waitForZhihuDraft(page: Page, timeout: number): Promise<boolean> {
  await page.waitForTimeout(2_000);
  const hasDraftUrl = /^https:\/\/zhuanlan\.zhihu\.com\/p\/\d+\/edit(?:[/?#]|$)/i.test(page.url());
  if (!hasDraftUrl) {
    return false;
  }

  return waitForBodyPattern(page, /(?:刚刚|\d+\s*(?:秒|分钟)前)\s*·\s*草稿|草稿已保存|保存成功/, timeout);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isZhihuUrl(url: string): boolean {
  return /^https:\/\/([a-z0-9-]+\.)*zhihu\.com\//i.test(url);
}
