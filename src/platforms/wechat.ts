import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  clickSaveAndConfirm,
  replaceImageMarkers,
  waitForBodyPattern
} from "../core/article-browser.js";
import type { CreateArticlePostDraftInput } from "../core/schemas.js";
import { getBrowserSession } from "../core/browser.js";
import { prepareMarkdownArticle } from "../core/markdown-article.js";
import { clickFirstUsable, hasAnyVisible, safeGoto } from "../core/playwright-helpers.js";
import type { CreateArticlePostDraftResult, LoginStatusResult, OpenLoginPageResult, PlatformAdapter } from "./types.js";

const homeUrl = "https://mp.weixin.qq.com/";
const loginSignals = ["text=/扫码登录|账号登录|请使用微信扫描/", ".login__type__container"];
const loggedInSignals = ["text=/新的创作|草稿箱|内容与互动|首页/", ".weui-desktop-account__info"];
const titleSelectors = ["#title", "textarea[placeholder*='标题']", "input[placeholder*='标题']"];
const editorSelectors = [
  ".ProseMirror:has-text('从这里开始写正文')",
  ".ProseMirror[contenteditable='true']",
  "#ueditor_0",
  ".edui-body-container"
];
const imageButtons = [
  ".tpl_item.tpl_item_dropdown.jsInsertIcon.img",
  "text=图片"
];
const coverButtons = ["text=拖拽或选择封面", "text=选择封面", "button:has-text('封面')"];
const saveButtons = ["button:has-text('保存为草稿')", "button:has-text('保存')", "text=保存为草稿"];

export const wechatAdapter: PlatformAdapter = {
  platform: "wechat",
  capabilities: { articlePostDraft: true },
  async checkLoginStatus(): Promise<LoginStatusResult> {
    const { page } = await getBrowserSession("wechat");
    if (!isWechatUrl(page.url())) {
      await safeGoto(page, homeUrl);
    }
    const hasLogin = await hasAnyVisible(page, loginSignals);
    const hasLoggedInUi = await hasAnyVisible(page, loggedInSignals);
    return {
      platform: "wechat",
      loggedIn: hasLoggedInUi && !hasLogin,
      message: hasLoggedInUi && !hasLogin ? "WeChat Official Account appears to be logged in." : "WeChat Official Account login is required."
    };
  },
  async openLoginPage(): Promise<OpenLoginPageResult> {
    const { page } = await getBrowserSession("wechat");
    if (!isWechatUrl(page.url())) {
      await safeGoto(page, homeUrl);
    }
    return {
      platform: "wechat",
      opened: true,
      message: "Opened WeChat Official Account. Complete QR login in the browser window."
    };
  },
  async createArticlePostDraft(input: CreateArticlePostDraftInput): Promise<CreateArticlePostDraftResult> {
    const login = await this.checkLoginStatus();
    if (!login.loggedIn) {
      return { platform: "wechat", status: "login_required", message: "WeChat login is required before creating a draft." };
    }

    const prepared = await prepareMarkdownArticle(input.markdownPath);
    try {
      const { page } = await getBrowserSession("wechat");
      const editorPage = await openWechatArticleEditor(page);
      const editorOpened = editorPage !== null;
      const activePage = editorPage || page;
      const bodyFilled = editorOpened && (await fillWechatEditorHtml(activePage, prepared.html));
      const titleFilled = bodyFilled && (await fillWechatField(activePage, "#title", input.title));
      const imageResult = bodyFilled
        ? await replaceImageMarkers(activePage, editorSelectors, imageButtons, prepared.images, {
            openUploadBeforeSelect: true,
            skipUploadTrigger: true
          })
        : { replaced: 0, failedMarker: prepared.images[0]?.marker };
      const bodyImagesUploaded = !imageResult.failedMarker
        ? await waitForWechatBodyImagesUploaded(activePage, prepared.images.length)
        : false;
      const coverSet = bodyImagesUploaded && input.coverImage
        ? await setWechatCover(activePage, input.coverImage)
        : false;
      const digest = prepared.plainText.slice(0, 120);
      const digestFilled = digest
        ? await fillWechatField(activePage, "#js_description", digest).catch(() => false)
        : true;
      const warnings = [...prepared.warnings];
      if (input.tags?.length) {
        warnings.push("WeChat does not use the article tags parameter.");
      }
      if (input.category) {
        warnings.push("WeChat does not use the article category parameter.");
      }
      if (!digestFilled) {
        warnings.push("WeChat summary could not be filled; the platform may generate it automatically.");
      }

      const saveTriggered = editorOpened && titleFilled && bodyFilled && !imageResult.failedMarker && coverSet
        ? await clickSaveAndConfirm(activePage, saveButtons, /保存成功|已保存|草稿箱/, 30_000)
        : false;
      const saved = saveTriggered
        ? await waitForWechatDraftSaved(activePage)
        : false;
      if (process.env.ARTICLE_SMOKE_DIAGNOSTICS === "1") {
        await captureWechatDiagnostic(activePage, saved ? "draft-created" : "draft-failed");
      }

      return saved
        ? { platform: "wechat", status: "draft_created", message: "WeChat article draft was created.", warnings }
        : {
            platform: "wechat",
            status: "failed",
            message: `WeChat draft was not completed. editor=${editorOpened}, title=${titleFilled}, body=${bodyFilled}, images=${imageResult.replaced}/${prepared.images.length}, cover=${coverSet}, saved=${saved}.`,
            warnings
          };
    } finally {
      await prepared.cleanup();
    }
  }
};

async function openWechatArticleEditor(
  page: Awaited<ReturnType<typeof getBrowserSession>>["page"]
): Promise<Awaited<ReturnType<typeof getBrowserSession>>["page"] | null> {
  await safeGoto(page, homeUrl);
  const directHref = await page
    .evaluate(() => {
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
      return links.find((link) => /图文消息|新的创作/.test(link.textContent || ""))?.href || null;
    })
    .catch(() => null);

  if (directHref) {
    await safeGoto(page, directHref);
  } else {
    const popupPromise = page.context().waitForEvent("page", { timeout: 5_000 }).catch(() => null);
    const opened = await clickFirstUsable(page, [
      "text=文章",
      "text=图文消息",
      "a:has-text('图文消息')"
    ]);
    if (!opened) {
      await captureWechatDiagnostic(page, "editor-entry-not-found");
      return null;
    }
    const popup = await popupPromise;
    if (popup) {
      await popup.waitForLoadState("domcontentloaded").catch(() => undefined);
      page = popup;
    } else {
      await page.waitForTimeout(1_000);
    }
  }

  const editorReady =
    (await page.locator("#title").count().catch(() => 0)) > 0 ||
    (await hasAnyVisible(page, titleSelectors));
  if (!editorReady) {
    await captureWechatDiagnostic(page, "editor-title-not-found");
  }
  return editorReady ? page : null;
}

async function setWechatCover(
  page: Awaited<ReturnType<typeof getBrowserSession>>["page"],
  coverImage: string
): Promise<boolean> {
  const opened = await clickFirstUsable(page, coverButtons).catch(() => false);
  if (!opened) {
    return false;
  }
  await page.waitForTimeout(300);
  const fromLibrary = await clickFirstUsable(page, ["text=从图片库选择"]).catch(() => false);
  if (!fromLibrary) {
    return false;
  }
  await page.waitForTimeout(500);
  const libraryInput = page
    .locator(".weui-desktop-dialog__wrp:visible input[type='file'][accept*='bmp']")
    .last();
  if ((await libraryInput.count()) === 0) {
    await captureWechatDiagnostic(page, "cover-library-input-not-found");
    return false;
  }
  await libraryInput.setInputFiles(coverImage);

  const thumbnailDeadline = Date.now() + 60_000;
  let thumbnail = await firstVisibleCoverThumbnail(page);
  while (!thumbnail && Date.now() < thumbnailDeadline) {
    await page.waitForTimeout(500);
    thumbnail = await firstVisibleCoverThumbnail(page);
  }
  if (!thumbnail) {
    await captureWechatDiagnostic(page, "cover-thumbnail-not-found");
    return false;
  }
  const thumbnailItem = thumbnail.locator(
    "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' item ') or contains(@class,'item')][1]"
  );
  if ((await thumbnailItem.count()) > 0) {
    await thumbnailItem.click({ force: true });
  } else {
    await thumbnail.locator("xpath=..").click({ force: true });
  }
  await page.waitForTimeout(200);

  const pickerDialog = page.locator(".weui-desktop-dialog_img-picker:visible").last();
  const nextButton = pickerDialog.getByText("下一步", { exact: true }).last();
  if (!await nextButton.isVisible().catch(() => false)) {
    await captureWechatDiagnostic(page, "cover-next-not-found");
    return false;
  }
  const nextDisabled = await nextButton.evaluate((node) => {
    const element = node instanceof HTMLElement ? node : node.parentElement;
    if (!element) {
      return true;
    }
    return (
      element.hasAttribute("disabled") ||
      element.getAttribute("aria-disabled") === "true" ||
      /disabled/.test(element.className)
    );
  }).catch(() => true);
  if (nextDisabled) {
    await captureWechatDiagnostic(page, "cover-thumbnail-not-selected");
    return false;
  }
  await nextButton.click({ force: true });

  await page.waitForTimeout(500);
  const confirmButton = page
    .locator(".weui-desktop-dialog__ft button.weui-desktop-btn_primary")
    .filter({ hasText: "确认" })
    .last();
  const confirmReady = await confirmButton
    .waitFor({ state: "visible", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (!confirmReady) {
    await captureWechatDiagnostic(page, "cover-confirm-not-found");
    return false;
  }
  await confirmButton.click();

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const cropClosed = !await hasAnyVisible(page, ["text=编辑封面"]);
    const placeholderVisible = await hasAnyVisible(page, [coverButtons[0]]);
    if (cropClosed && !placeholderVisible) {
      return true;
    }
    if (cropClosed) {
      await page.waitForTimeout(1_000);
      return true;
    }
    await page.waitForTimeout(500);
  }
  return false;
}

async function waitForWechatBodyImagesUploaded(
  page: Awaited<ReturnType<typeof getBrowserSession>>["page"],
  expected: number
): Promise<boolean> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const sources = await page
      .locator(".ProseMirror:has-text('FIRST_IMAGE_ANCHOR_BEFORE') img")
      .evaluateAll((images) =>
        images
          .map((image) => image.getAttribute("src") || "")
          .filter(Boolean)
      )
      .catch(() => []);
    const remoteSources = sources.filter((source) =>
      /^https:\/\/mmbiz\.qpic\.cn\//.test(source)
    );
    if (remoteSources.length >= expected) {
      return true;
    }
    await page.waitForTimeout(500);
  }
  return false;
}

async function waitForWechatDraftSaved(
  page: Awaited<ReturnType<typeof getBrowserSession>>["page"]
): Promise<boolean> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (/[?&]appmsgid=\d+/.test(page.url())) {
      return true;
    }
    await page.waitForTimeout(500);
  }
  return false;
}

async function firstVisibleCoverThumbnail(
  page: Awaited<ReturnType<typeof getBrowserSession>>["page"]
) {
  const libraryThumbnails = page.locator(
    ".weui-desktop-dialog__wrp:visible .weui-desktop-img-picker__img-thumb"
  );
  const libraryThumbnailCount = await libraryThumbnails.count();
  for (let index = 0; index < libraryThumbnailCount; index += 1) {
    const thumbnail = libraryThumbnails.nth(index);
    if (await thumbnail.isVisible().catch(() => false)) {
      return thumbnail;
    }
  }

  const instruction = page
    .getByText("请从正文插入的图片和视频封面中选择封面", { exact: true })
    .last();
  if (await instruction.isVisible().catch(() => false)) {
    const container = page
      .locator(".weui-desktop-dialog__wrp:visible")
      .filter({ hasText: "请从正文插入的图片和视频封面中选择封面" })
      .last();
    const scopedImages = container.locator("img");
    const scopedCount = await scopedImages.count();
    for (let index = 0; index < scopedCount; index += 1) {
      const image = scopedImages.nth(index);
      const visible = await image.isVisible().catch(() => false);
      const source = await image.getAttribute("src").catch(() => null);
      const box = await image.boundingBox().catch(() => null);
      if (
        visible &&
        source &&
        !/wx\.qlogo\.cn/.test(source) &&
        box &&
        box.width >= 40 &&
        box.height >= 40
      ) {
        return image;
      }
    }

    const descendants = container.locator("*");
    const backgroundIndex = await descendants.evaluateAll((nodes) =>
      nodes.findIndex((node) => {
        if (!(node instanceof HTMLElement)) {
          return false;
        }
        const rect = node.getBoundingClientRect();
        const background = getComputedStyle(node).backgroundImage;
        return (
          rect.width >= 40 &&
          rect.height >= 40 &&
          background !== "none" &&
          /(?:url|image-set)\(/.test(background) &&
          !/wx\.qlogo\.cn/.test(background)
        );
      })
    );
    if (backgroundIndex >= 0) {
      return descendants.nth(backgroundIndex);
    }
  }

  const selectors = [
    ".weui-desktop-dialog_img-picker img",
    ".weui-desktop-dialog img",
    ".weui-desktop-dialog__bd img",
    "[role='dialog'] img"
  ];

  for (const selector of selectors) {
    const images = page.locator(selector);
    const count = await images.count();
    for (let index = 0; index < count; index += 1) {
      const image = images.nth(index);
      const visible = await image.isVisible().catch(() => false);
      const source = await image.getAttribute("src").catch(() => null);
      if (
        visible &&
        source &&
        !/wx\.qlogo\.cn/.test(source) &&
        /(?:mmbiz\.qpic\.cn|^data:image\/)/.test(source)
      ) {
        return image;
      }
    }
  }

  return null;
}

async function fillWechatField(
  page: Awaited<ReturnType<typeof getBrowserSession>>["page"],
  selector: string,
  value: string
): Promise<boolean> {
  const field = page.locator(selector).first();
  if ((await field.count()) === 0) {
    return false;
  }

  return field
    .fill(value, { force: true })
    .then(() => true)
    .catch(() =>
      field
        .evaluate((node, nextValue) => {
          if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)) {
            return false;
          }
          const prototype = node instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
          setter?.call(node, nextValue);
          node.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: nextValue }));
          node.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }, value)
        .catch(() => false)
    );
}

async function fillWechatEditorHtml(
  page: Awaited<ReturnType<typeof getBrowserSession>>["page"],
  html: string
): Promise<boolean> {
  const editor = page.locator(".ProseMirror").filter({ hasText: "从这里开始写正文" }).last();
  const ready = await editor.waitFor({ state: "visible", timeout: 10_000 }).then(() => true).catch(() => false);
  if (!ready) {
    return false;
  }

  const pasted = await editor
    .evaluate((node, nextHtml) => {
      const target = node as HTMLElement;
      const parsed = new DOMParser().parseFromString(nextHtml, "text/html");
      const transfer = new DataTransfer();
      transfer.setData("text/html", nextHtml);
      transfer.setData("text/plain", parsed.body.innerText);
      target.focus();
      target.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: transfer
        })
      );
      return true;
    }, html)
    .catch(() => false);
  if (!pasted) {
    return false;
  }

  return waitForBodyPattern(page, /SOCIALMEDIAIMAGE\d{4}TOKEN/, 10_000);
}

function isWechatUrl(url: string): boolean {
  return /^https:\/\/mp\.weixin\.qq\.com\//i.test(url);
}

async function captureWechatDiagnostic(
  page: Awaited<ReturnType<typeof getBrowserSession>>["page"],
  name: string
): Promise<void> {
  if (process.env.ARTICLE_SMOKE_DIAGNOSTICS !== "1") {
    return;
  }

  const directory = resolve(process.cwd(), ".screenshots");
  await mkdir(directory, { recursive: true });
  const screenshotPath = resolve(directory, `wechat-${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
  const summary = await page
    .evaluate(() => {
      const article = Array.from(document.querySelectorAll<HTMLElement>(".ProseMirror"))
        .find((editor) => (editor.textContent || "").includes("FIRST_IMAGE_ANCHOR_BEFORE"));
      const articleSequence: string[] = [];
      if (article) {
        const walker = document.createTreeWalker(article, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
          if (node instanceof HTMLImageElement) {
            articleSequence.push("IMAGE");
          } else if (node.nodeType === Node.TEXT_NODE) {
            const text = (node.textContent || "").trim();
            for (const anchor of [
              "FIRST_IMAGE_ANCHOR_BEFORE",
              "FIRST_IMAGE_ANCHOR_AFTER",
              "SECOND_IMAGE_ANCHOR_BEFORE",
              "SECOND_IMAGE_ANCHOR_AFTER"
            ]) {
              if (text.includes(anchor)) {
                articleSequence.push(anchor);
              }
            }
          }
          node = walker.nextNode();
        }
      }

      return {
        url: location.href,
        title: document.title,
        text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 4_000),
        articleSequence,
        articleImages: article
          ? Array.from(article.querySelectorAll<HTMLImageElement>("img")).map((image) =>
              image.src.startsWith("data:") ? `${image.src.slice(0, 32)}...` : image.src
            )
          : [],
        links: Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
        .map((link) => ({ text: (link.innerText || "").replace(/\s+/g, " ").trim(), href: link.href }))
        .filter((link) => link.text)
        .slice(0, 100),
      fields: Array.from(
        document.querySelectorAll<HTMLElement>("input, textarea, [contenteditable='true']")
      ).map((field) => ({
        tag: field.tagName.toLowerCase(),
        id: field.id,
        className: field.className,
        placeholder: field.getAttribute("placeholder"),
        role: field.getAttribute("role"),
        type: field.getAttribute("type"),
        accept: field.getAttribute("accept"),
        text: (field.innerText || "").replace(/\s+/g, " ").trim().slice(0, 200)
      })),
      imageControls: Array.from(
        document.querySelectorAll<HTMLElement>("button, [role='button'], [title], [aria-label]")
      )
        .map((control) => ({
          tag: control.tagName.toLowerCase(),
          className: control.className,
          title: control.getAttribute("title"),
          ariaLabel: control.getAttribute("aria-label"),
          text: (control.innerText || "").replace(/\s+/g, " ").trim()
        }))
        .filter((control) => /图片|上传/.test(`${control.text} ${control.title} ${control.ariaLabel}`))
        .slice(0, 100),
      imageTextElements: Array.from(document.querySelectorAll<HTMLElement>("*"))
        .filter((element) => element.children.length === 0 && element.textContent?.trim() === "图片")
        .map((element) => ({
          tag: element.tagName.toLowerCase(),
          className: element.className,
          parentTag: element.parentElement?.tagName.toLowerCase() || null,
          parentClassName: element.parentElement?.className || null,
          grandparentClassName: element.parentElement?.parentElement?.className || null
        })),
      fileInputs: Array.from(document.querySelectorAll<HTMLInputElement>("input[type='file']")).map((input) => ({
        accept: input.accept,
        className: input.className,
        parentClassName: input.parentElement?.className || null,
        grandparentClassName: input.parentElement?.parentElement?.className || null,
        greatGrandparentClassName: input.parentElement?.parentElement?.parentElement?.className || null
      }))
      };
    })
    .catch(() => null);
  console.error(JSON.stringify({ step: "wechat-diagnostic", screenshotPath, summary }, null, 2));
}
