import type { Page } from "playwright";
import { importMarkdownFile, replaceImageMarkers, waitForBodyPattern } from "../core/article-browser.js";
import type { CreateArticlePostDraftInput } from "../core/schemas.js";
import { getBrowserSession } from "../core/browser.js";
import { prepareMarkdownArticle } from "../core/markdown-article.js";
import {
  clickElementContainingText,
  clickFirstUsable,
  fillFirstVisible,
  firstVisibleLocator,
  hasAnyVisible,
  safeGoto
} from "../core/playwright-helpers.js";
import type { CreateArticlePostDraftResult, LoginStatusResult, OpenLoginPageResult, PlatformAdapter } from "./types.js";

const homeUrl = "https://mp.csdn.net/";
const editorUrl = "https://editor.csdn.net/md/?not_checkout=1";
const loginSignals = ["text=/登录|注册|验证码登录/", "input[placeholder*='手机号']"];
const loggedInSignals = ["text=/创作中心|内容管理|写文章|博客管理/", "[class*='avatar']"];
const importButtons = ["button:has-text('导入')", "text=导入", "[title*='导入']"];
const titleSelectors = [
  "input[placeholder*='标题']",
  "textarea[placeholder*='标题']",
  "input[maxlength='100']",
  "input[type='text']",
  "input:not([type])",
  "#article-title"
];
const editorSelectors = ["textarea", ".CodeMirror textarea", "[contenteditable='true']", ".markdown-body"];
const imageButtons = ["button:has-text('图片')", "[title*='图片']", "[aria-label*='图片']"];

export const csdnAdapter: PlatformAdapter = {
  platform: "csdn",
  capabilities: { articlePostDraft: true },
  async checkLoginStatus(): Promise<LoginStatusResult> {
    const { page } = await getBrowserSession("csdn");
    if (!isCsdnUrl(page.url())) {
      await safeGoto(page, homeUrl);
    }
    const hasLogin = await hasAnyVisible(page, loginSignals);
    const hasLoggedInUi = await hasAnyVisible(page, loggedInSignals);
    return {
      platform: "csdn",
      loggedIn: hasLoggedInUi && !hasLogin,
      message: hasLoggedInUi && !hasLogin ? "CSDN appears to be logged in." : "CSDN login is required."
    };
  },
  async openLoginPage(): Promise<OpenLoginPageResult> {
    const { page } = await getBrowserSession("csdn");
    if (!isCsdnUrl(page.url())) {
      await safeGoto(page, homeUrl);
    }
    return { platform: "csdn", opened: true, message: "Opened CSDN creator page. Complete login in the browser window." };
  },
  async createArticlePostDraft(input: CreateArticlePostDraftInput): Promise<CreateArticlePostDraftResult> {
    const login = await this.checkLoginStatus();
    if (!login.loggedIn) {
      return { platform: "csdn", status: "login_required", message: "CSDN login is required before creating a draft." };
    }

    const prepared = await prepareMarkdownArticle(input.markdownPath);
    try {
      const { page } = await getBrowserSession("csdn");
      await safeGoto(page, editorUrl);
      await clickFirstUsable(page, ["button:has-text('我知道了')", "text=我知道了"]).catch(() => false);
      const imported = await importMarkdownFile(page, prepared.normalizedMarkdownPath, importButtons);
      const importReady = imported && (await waitForImport(page, prepared));
      const titleFilled = await fillCsdnTitle(page, input.title);
      const imageResult = importReady
        ? await replaceImageMarkers(page, editorSelectors, imageButtons, prepared.images, {
            keyboardShortcut: "Meta+Shift+G"
          })
        : { replaced: 0, failedMarker: prepared.images[0]?.marker };
      const warnings = [...prepared.warnings];
      const tagsApplied = await applyCsdnTags(page, input.tags);
      if (input.tags?.length && !tagsApplied) {
        warnings.push("CSDN tags could not be applied automatically.");
      }
      const categoryApplied = await applyCsdnCategory(page, input.category);
      const saved = importReady && titleFilled && !imageResult.failedMarker && categoryApplied
        ? await saveCsdnDraft(page)
        : false;

      return saved
        ? { platform: "csdn", status: "draft_created", message: "CSDN article draft was created.", warnings }
        : {
            platform: "csdn",
            status: "failed",
            message: `CSDN draft was not completed. imported=${importReady}, title=${titleFilled}, images=${imageResult.replaced}/${prepared.images.length}, category=${categoryApplied}, saved=${saved}.`,
            warnings
          };
    } finally {
      await prepared.cleanup();
    }
  }
};

async function waitForImport(page: Page, prepared: Awaited<ReturnType<typeof prepareMarkdownArticle>>): Promise<boolean> {
  const marker = prepared.images[0]?.marker;
  if (marker) {
    return waitForBodyPattern(page, new RegExp(marker), 20_000);
  }
  const snippet = prepared.plainText.slice(0, 40);
  return snippet.length > 0
    ? waitForBodyPattern(page, new RegExp(escapeRegExp(snippet)), 20_000)
    : false;
}

async function applyCsdnTags(page: Page, tags: string[] | undefined): Promise<boolean> {
  if (!tags?.length) {
    return true;
  }
  const input = page.locator("input[placeholder*='标签'], input[placeholder*='关键词']").first();
  if (!(await input.isVisible().catch(() => false))) {
    return false;
  }
  await input.fill(tags.join(","));
  return true;
}

async function applyCsdnCategory(page: Page, category: string | undefined): Promise<boolean> {
  if (!category) {
    return true;
  }
  const opened = await clickElementContainingText(page, "分类").catch(() => false);
  if (!opened) {
    return false;
  }
  await page.waitForTimeout(300);
  return clickElementContainingText(page, category).catch(() => false);
}

async function saveCsdnDraft(page: Page): Promise<boolean> {
  const opened = await clickFirstUsable(page, ["button:has-text('保存草稿')", "button:has-text('保存')"])
    .catch(() => false);
  if (opened) {
    await page.waitForTimeout(300);
    const menuItem = await firstVisibleLocator(page, ["a:has-text('保存草稿')"]);
    await menuItem?.click().catch(() => undefined);
  }

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (/[?&]articleId=\d+/.test(page.url())) {
      return true;
    }
    if (await waitForBodyPattern(page, /保存成功|草稿已保存|已保存/, 1_000)) {
      return true;
    }
  }

  return false;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isCsdnUrl(url: string): boolean {
  return /^https:\/\/([a-z0-9-]+\.)*csdn\.net\//i.test(url);
}

async function fillCsdnTitle(page: Page, title: string): Promise<boolean> {
  if (await fillFirstVisible(page, titleSelectors, title)) {
    return true;
  }

  const importedTitle = await firstVisibleLocator(page, ['text="article"', 'text="【无标题】"']);
  if (importedTitle) {
    const replaced = await importedTitle
      .click()
      .then(async () => {
        await page.keyboard.press("Meta+A");
        await page.keyboard.type(title);
        await page.keyboard.press("Tab");
        return waitForBodyPattern(page, new RegExp(escapeRegExp(title)), 5_000);
      })
      .catch(() => false);
    if (replaced) {
      return true;
    }
  }

  return page
    .evaluate((value) => {
      const candidates = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea"))
        .filter((element) => {
          const type = element instanceof HTMLInputElement ? element.type : "";
          const rect = element.getBoundingClientRect();
          return type !== "file" && rect.width >= 240 && rect.height >= 20 && rect.top < 180;
        })
        .sort((left, right) => scoreTitleInput(right) - scoreTitleInput(left));
      const input = candidates[0];
      if (!input) {
        return false;
      }

      const prototype = input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      setter?.call(input, value);
      input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.blur();
      return input.value === value;

      function scoreTitleInput(element: HTMLInputElement | HTMLTextAreaElement): number {
        const placeholder = element.getAttribute("placeholder") || "";
        const rect = element.getBoundingClientRect();
        return (element.maxLength === 100 ? 100 : 0)
          + (/标题/.test(placeholder) ? 50 : 0)
          + (rect.top < 120 ? 20 : 0)
          + Math.min(rect.width / 100, 10);
      }
    }, title)
    .catch(() => false);
}
