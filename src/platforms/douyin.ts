import type { Page } from "playwright";
import type {
  CoverOrientation,
  CreateImagePostDraftInput,
  CreateVideoPostDraftInput,
  SubmitVerificationCodeInput
} from "../core/schemas.js";
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
  PlatformAdapter,
  SubmitVerificationCodeResult
} from "./types.js";

const homeUrl = "https://creator.douyin.com/";
const manageUrl = "https://creator.douyin.com/creator-micro/content/manage";
const uploadUrl = "https://creator.douyin.com/creator-micro/content/upload";
const imagePostUrl =
  "https://creator.douyin.com/creator-micro/content/post/image?default-tab=3&enter_from=publish_page&media_type=image&type=new";
const videoPostUrl = "https://creator.douyin.com/creator-micro/content/post/video?enter_from=publish_page";

const loginSignals = [
  "text=/登录|扫码|验证码|手机号/",
  "input[placeholder*='手机号']",
  "input[placeholder*='验证码']"
];

const loggedInSignals = [
  "text=/高清发布|内容管理|作品管理|合集管理|互动管理|数据中心|变现中心/"
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
  "textarea[placeholder*='内容']",
  "textarea[placeholder*='正文']",
  "[contenteditable='true'][placeholder*='简介']",
  "[contenteditable='true'][placeholder*='描述']",
  "[contenteditable='true'][data-placeholder*='简介']",
  "[contenteditable='true'][data-placeholder*='描述']"
];

const metadataReadySelectors = [
  ...titleSelectors,
  ...contentSelectors,
  "text=/作品描述|作品标题|填写作品标题|填写作品简介/"
];

const imageUploadReadySelectors = [
  "text=/已添加\\d+张图片/",
  "text=/继续添加/",
  "text=/编辑图片/",
  "text=/预览图文/"
];

const videoUploadReadySelectors = [
  "text=/设置封面/",
  "text=/预览视频/",
  "text=/预览封面\\/标题/",
  "text=/添加合集/",
  "text=/自主声明/"
];

const uploadStartSelectors = [
  "text=/点击上传|上传图文|上传视频|直接将视频文件拖入此区域/"
];

const dismissSelectors = [
  "button:has-text('完成')",
  "button:has-text('我知道了')",
  "button:has-text('知道了')",
  "button:has-text('关闭')",
  "text=/完成|我知道了|知道了|关闭/"
];

const privateVisibilitySelectors = [
  "label:has-text('仅自己可见')",
  "button:has-text('仅自己可见')",
  "text=/仅自己可见/"
];

const publishButtonSelectors = [
  "button:has-text('发布')",
  "button:has-text('立即发布')",
  "text=/发布$/"
];

const verificationModalSelectors = [
  "text=/接收短信验证码/",
  "text=/请输入验证码/",
  "button:has-text('获取验证码')",
  "button:has-text('验证')"
];

const verificationCodeInputSelectors = [
  "input[placeholder*='验证码']",
  "input[placeholder*='请输入验证码']",
  "input[type='text']"
];

const confirmVerificationSelectors = [
  "button:has-text('验证')",
  "text=/验证$/"
];

const coverConfirmSelectors = [
  "button:has-text('确定')",
  "button:has-text('完成')",
  "button:has-text('保存')",
  "button:has-text('应用')",
  "button:has-text('使用当前封面')",
  "text=/确定|完成|保存|应用|使用当前封面/"
];

const uploadProcessingPattern =
  /上传中|处理中|校验中|正在上传|正在处理|转码中|封面上传中|封面处理中/;
const videoUploadInProgressPattern =
  /文件解析中，请稍等|上传过程中请不要删除\/移动文件|上传中|处理中|转码中|\b\d{1,3}%\b/;
const verificationCodeRequestedPattern = /重新发送|秒后重发|秒后重新获取|\d+\s*秒/;

export const douyinSelectorDiagnostics = {
  loginSignals,
  imageModeSelectors,
  titleSelectors,
  contentSelectors,
  imageUploadReadySelectors,
  videoUploadReadySelectors,
  privateVisibilitySelectors,
  publishButtonSelectors,
  verificationModalSelectors
} as const;

export function formatDouyinCaption(content: string, tags: string[] | undefined): string {
  const base = content.trim();
  const formattedTags = formatTopicTags(tags);
  return formattedTags.length === 0 ? base : [base, formattedTags.join(" ")].filter(Boolean).join("\n\n");
}

export function formatDouyinAddedImagesText(count: number): string {
  return `已添加${count}张图片`;
}

type DouyinFileInputDescriptor = {
  accept: string | null;
  multiple: boolean;
};

export function chooseDouyinFileInputIndex(
  descriptors: DouyinFileInputDescriptor[],
  mode: "image" | "video"
): number {
  const normalized = descriptors.map((descriptor) => (descriptor.accept || "").toLowerCase());

  if (mode === "video") {
    const videoIndex = normalized.findIndex((accept) => accept.includes("video/") || accept.includes(".mp4"));
    if (videoIndex >= 0) {
      return videoIndex;
    }
  }

  const imageIndex = normalized.findIndex(
    (accept) => accept.includes("image/") || accept.includes(".png") || accept.includes(".jpg") || accept.includes(".jpeg")
  );
  if (imageIndex >= 0) {
    return imageIndex;
  }

  return mode === "image" && descriptors.length > 1 ? 1 : 0;
}

export const douyinAdapter: PlatformAdapter = {
  platform: "douyin",
  capabilities: { imagePostDraft: true, videoPostDraft: true, verificationCodeSubmission: true },
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
    const uploadReady = await waitForDouyinImageProcessingComplete(page, input.images.length);
    await page.waitForTimeout(1_500);
    await dismissDouyinOverlays(page);
    await waitForAnyVisible(page, metadataReadySelectors, 20_000);

    const metadata = await fillDouyinMetadata(page, input.title, input.content, input.tags);
    const prepared = await prepareDouyinPrivateDraft(page);
    const published = prepared ? await publishDouyinPost(page) : false;
    const verificationRequired = published ? await handleDouyinVerificationPrompt(page) : false;

    if (verificationRequired) {
      return {
        platform: "douyin",
        status: "verification_required",
        message: "Douyin requested an SMS verification code. The code has been requested; provide the code to continue."
      };
    }

    if (!uploaded || !uploadReady || !metadata.filledTitle || !metadata.filledContent || !prepared || !published) {
      return {
        platform: "douyin",
        status: "failed",
        message: `Douyin image post was not completed. uploaded=${uploaded}, uploadReady=${uploadReady}, title=${metadata.filledTitle}, content=${metadata.filledContent}, prepared=${prepared}, published=${published}.`
      };
    }

    return {
      platform: "douyin",
      status: "draft_created",
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
    const uploadReady = await waitForDouyinVideoProcessingComplete(page, 240_000);
    await page.waitForTimeout(2_000);
    await dismissDouyinOverlays(page);
    await waitForAnyVisible(page, metadataReadySelectors, 30_000);

    const metadata = await fillDouyinMetadata(page, input.title, input.content, input.tags);
    const coverSet = input.coverImage
      ? await configureDouyinVideoCover(page, input.coverImage, input.coverOrientation ?? "vertical")
      : true;
    const prepared = coverSet ? await prepareDouyinPrivateDraft(page) : false;
    const published = prepared ? await publishDouyinPost(page) : false;
    const verificationRequired = published ? await handleDouyinVerificationPrompt(page) : false;

    if (verificationRequired) {
      return {
        platform: "douyin",
        status: "verification_required",
        message: "Douyin requested an SMS verification code. The code has been requested; provide the code to continue."
      };
    }

    if (!uploaded || !uploadReady || !metadata.filledTitle || !metadata.filledContent || !coverSet || !prepared || !published) {
      const uploadInputStillVisible = await hasAnyVisible(page, uploadStartSelectors);
      return {
        platform: "douyin",
        status: "failed",
        message: uploadInputStillVisible
          ? `Douyin video post was not completed because the page did not enter the editor after selecting the file. uploaded=${uploaded}, uploadReady=${uploadReady}, title=${metadata.filledTitle}, content=${metadata.filledContent}, coverSet=${coverSet}, prepared=${prepared}, published=${published}.`
          : `Douyin video post was not completed. uploaded=${uploaded}, uploadReady=${uploadReady}, title=${metadata.filledTitle}, content=${metadata.filledContent}, coverSet=${coverSet}, prepared=${prepared}, published=${published}.`
      };
    }

    return {
      platform: "douyin",
      status: "draft_created",
      message: "Douyin video post was published with private visibility."
    };
  },
  async submitVerificationCode(input: SubmitVerificationCodeInput): Promise<SubmitVerificationCodeResult> {
    const { page } = await getBrowserSession("douyin");
    const modalVisible = await waitForAnyVisible(page, verificationModalSelectors, 5_000);

    if (!modalVisible) {
      return {
        platform: "douyin",
        status: "failed",
        message: "Douyin verification dialog is not visible."
      };
    }

    const filled = await fillVerificationCode(page, input.code);
    const submitted = filled ? await submitVerificationDialog(page) : false;

    return submitted
      ? {
          platform: "douyin",
          status: "verified",
          message: "Douyin verification code was submitted."
        }
      : {
          platform: "douyin",
          status: "failed",
          message: `Douyin verification code submission failed. filled=${filled}, submitted=${submitted}.`
        };
  }
};

function isLoginUrl(url: string): boolean {
  return /passport|login|sso/i.test(url);
}

async function hasLoginText(page: Page): Promise<boolean> {
  return page
    .evaluate(() => {
      const text = document.body.textContent || "";
      return /扫码登录|验证码登录|密码登录|登录\/注册|请输入手机号|请输入验证码/.test(text);
    })
    .catch(() => false);
}

async function openUploadPage(page: Page, mode: "image" | "video"): Promise<void> {
  await safeGoto(page, mode === "image" ? imagePostUrl : videoPostUrl);
  await page.waitForTimeout(1_000);

  if (!(await hasAnyVisible(page, metadataReadySelectors)) && !(await hasAnyVisible(page, uploadStartSelectors))) {
    await safeGoto(page, uploadUrl);
  }
}

async function waitForDouyinImageProcessingComplete(page: Page, expectedCount: number, timeout = 180_000): Promise<boolean> {
  const expectedText = formatDouyinAddedImagesText(expectedCount);
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const readySelectorsVisible = await hasAnyVisible(page, imageUploadReadySelectors);
    const uploadState = await getUploadState(page, expectedText);

    if ((readySelectorsVisible || uploadState.hasExpectedCount) && !uploadState.hasProcessing) {
      return true;
    }

    await page.waitForTimeout(1_000);
  }

  return false;
}

async function waitForDouyinVideoProcessingComplete(page: Page, timeout = 240_000): Promise<boolean> {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const uploadState = await getDouyinVideoUploadState(page);
    if (uploadState.previewReady && !uploadState.stillUploading) {
      return true;
    }

    await page.waitForTimeout(1_000);
  }

  return false;
}

async function getDouyinVideoUploadState(page: Page): Promise<{ previewReady: boolean; stillUploading: boolean }> {
  return page
    .evaluate(
      ({
        previewSelectors,
        inProgressPatternSource
      }: {
        previewSelectors: string[];
        inProgressPatternSource: string;
      }) => {
        const text = (document.body.textContent || "").replace(/\s+/g, " ");
        const inProgressPattern = new RegExp(inProgressPatternSource);
        const stillUploading = inProgressPattern.test(text);

        const previewReady = previewSelectors.some((selector) => {
          const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
          return nodes.some((node) => {
            const rect = node.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
        });

        const rightPreviewHasFrame = Array.from(document.querySelectorAll<HTMLElement>("img, video, canvas"))
          .some((node) => {
            const rect = node.getBoundingClientRect();
            return rect.width >= 120 && rect.height >= 200 && rect.left > window.innerWidth * 0.6;
          });

        return {
          previewReady: previewReady || rightPreviewHasFrame,
          stillUploading
        };
      },
      {
        previewSelectors: ["img", "video", "canvas"],
        inProgressPatternSource: videoUploadInProgressPattern.source
      }
    )
    .catch(() => ({ previewReady: false, stillUploading: true }));
}

async function getUploadState(page: Page, expectedText: string) {
  return page
    .evaluate(
      ({ countText, processingPatternSource }: { countText: string; processingPatternSource: string }) => {
        const text = document.body.textContent || "";
        const processingPattern = new RegExp(processingPatternSource);
        return {
          hasExpectedCount: text.includes(countText),
          hasProcessing: processingPattern.test(text)
        };
      },
      { countText: expectedText, processingPatternSource: uploadProcessingPattern.source }
    )
    .catch(() => ({ hasExpectedCount: false, hasProcessing: true }));
}

async function setFilesOnDouyinInput(page: Page, files: string[], mode: "image" | "video"): Promise<boolean> {
  const fileInputs = page.locator("input[type='file']");
  const count = await fileInputs.count();

  if (count === 0) {
    return false;
  }

  const descriptors: DouyinFileInputDescriptor[] = [];
  for (let index = 0; index < count; index += 1) {
    const descriptor = await fileInputs
      .nth(index)
      .evaluate((node) => {
        const input = node as HTMLInputElement;
        return {
          accept: input.getAttribute("accept"),
          multiple: input.multiple
        };
      })
      .catch(() => ({ accept: null, multiple: false }));
    descriptors.push(descriptor);
  }

  const index = chooseDouyinFileInputIndex(descriptors, mode);
  await fileInputs.nth(index).setInputFiles(files);
  return true;
}

async function fillDouyinMetadata(
  page: Page,
  title: string,
  content: string,
  tags: string[] | undefined
): Promise<{ filledTitle: boolean; filledContent: boolean }> {
  const filledTitle = await fillFirstVisible(page, titleSelectors, title);
  const caption = formatDouyinCaption(content, tags);
  const filledContent = await fillFirstVisible(page, contentSelectors, caption);
  return { filledTitle, filledContent };
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

async function configureDouyinVideoCover(page: Page, coverImage: string, primaryOrientation: CoverOrientation): Promise<boolean> {
  const orientations: CoverOrientation[] =
    primaryOrientation === "vertical" ? ["vertical", "horizontal"] : ["horizontal", "vertical"];

  for (const orientation of orientations) {
    const section = await findCoverSection(page);
    if (!section) {
      continue;
    }

    const uploadOk = await uploadCoverForOrientation(page, section, coverImage, orientation);
    if (!uploadOk) {
      continue;
    }

    await page.waitForTimeout(1_000);
    await clickFirstUsable(page, coverConfirmSelectors).catch(() => false);
    await page.waitForTimeout(1_000);
    return true;
  }

  return false;
}

async function findCoverSection(page: Page) {
  const sections = page.locator("section, div");
  const count = await sections.count();

  for (let index = 0; index < count; index += 1) {
    const candidate = sections.nth(index);
    const visible = await candidate.isVisible().catch(() => false);
    if (!visible) {
      continue;
    }

    const text = ((await candidate.textContent().catch(() => "")) || "").replace(/\s+/g, " ");
    if (text.includes("设置封面") && (text.includes("横封面") || text.includes("竖封面"))) {
      return candidate;
    }
  }

  return null;
}

async function uploadCoverForOrientation(
  page: Page,
  section: ReturnType<Page["locator"]>,
  coverImage: string,
  orientation: CoverOrientation
): Promise<boolean> {
  const label = orientation === "vertical" ? "竖封面3:4" : "横封面4:3";
  await clickCoverOrientationLabel(section, label);
  await page.waitForTimeout(500);

  const input = await pickCoverFileInput(section, orientation);
  if (input) {
    await input.setInputFiles(coverImage);
    return true;
  }

  const clicked = await clickCoverTileByLabel(section, label);
  if (!clicked) {
    return false;
  }

  await page.waitForTimeout(300);
  const fallbackInput = page.locator("input[type='file']").last();
  const visible = await fallbackInput.count().catch(() => 0);
  if (visible === 0) {
    return false;
  }

  await fallbackInput.setInputFiles(coverImage);
  return true;
}

async function clickCoverOrientationLabel(section: ReturnType<Page["locator"]>, label: string): Promise<void> {
  const target = section.getByText(label, { exact: false }).first();
  const visible = await target.isVisible().catch(() => false);
  if (visible) {
    await target.click().catch(() => undefined);
  }
}

async function pickCoverFileInput(section: ReturnType<Page["locator"]>, orientation: CoverOrientation) {
  const fileInputs = section.locator("input[type='file']");
  const count = await fileInputs.count();

  if (count === 0) {
    return null;
  }

  if (count === 1) {
    return fileInputs.first();
  }

  return orientation === "vertical" ? fileInputs.nth(1) : fileInputs.first();
}

async function clickCoverTileByLabel(section: ReturnType<Page["locator"]>, label: string): Promise<boolean> {
  return section
    .evaluate((node, labelText) => {
      const normalize = (value: string | null | undefined) => (value || "").replace(/\s+/g, "");
      const nodes = Array.from(node.querySelectorAll<HTMLElement>("div, button, label, span"));
      const labelNode = nodes.find((item) => normalize(item.textContent).includes(labelText));
      if (!labelNode) {
        return false;
      }

      const clickable =
        labelNode.closest<HTMLElement>("button, label, [role='button']") ??
        labelNode.parentElement?.closest<HTMLElement>("button, label, [role='button']") ??
        labelNode.parentElement ??
        labelNode;

      clickable.click();
      return true;
    }, label)
    .catch(() => false);
}

async function prepareDouyinPrivateDraft(page: Page): Promise<boolean> {
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => undefined);
  await page.waitForTimeout(1_000);

  const clicked = await clickFirstUsable(page, privateVisibilitySelectors).catch(() => false);
  if (clicked) {
    await page.waitForTimeout(500);
    return true;
  }

  return page
    .evaluate(() => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>("label, button, div, span"));
      const target = nodes.find((node) => (node.textContent || "").replace(/\s+/g, " ").includes("仅自己可见"));
      if (!target) {
        return false;
      }

      target.click();
      return true;
    })
    .catch(() => false);
}

async function publishDouyinPost(page: Page): Promise<boolean> {
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => undefined);
  await page.waitForTimeout(500);

  const clicked = await clickBottomPublishButton(page);
  if (clicked) {
    return true;
  }

  return clickFirstUsable(page, publishButtonSelectors).catch(() => false);
}

async function handleDouyinVerificationPrompt(page: Page): Promise<boolean> {
  const modalVisible = await waitForAnyVisible(page, verificationModalSelectors, 8_000);
  if (!modalVisible) {
    return false;
  }

  const clicked = await clickVerificationCodeButton(page);
  await page.waitForTimeout(800);
  return clicked;
}

async function clickVerificationCodeButton(page: Page): Promise<boolean> {
  const clickedInDialog = await page
    .evaluate((countdownPatternSource) => {
      const normalize = (value: string | null | undefined) => (value || "").replace(/\s+/g, " ").trim();
      const dialogSelectors = ["[role='dialog']", ".semi-modal", ".auxo-modal", ".auxo-drawer"];
      const dialogs = dialogSelectors.flatMap((selector) =>
        Array.from(document.querySelectorAll<HTMLElement>(selector))
      );
      const dialog = dialogs.find((item) => normalize(item.textContent).includes("接收短信验证码"));
      if (!dialog) {
        return false;
      }

      const dispatchClickSequence = (target: HTMLElement): boolean => {
        const rect = target.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          return false;
        }

        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(x, y) as HTMLElement | null;
        const receiver = hit ?? target;

        const pointerInit: PointerEventInit = {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId: 1,
          pointerType: "mouse",
          button: 0,
          buttons: 1,
          clientX: x,
          clientY: y
        };
        const mouseInit: MouseEventInit = {
          bubbles: true,
          cancelable: true,
          composed: true,
          button: 0,
          buttons: 1,
          clientX: x,
          clientY: y
        };

        receiver.dispatchEvent(new PointerEvent("pointerover", pointerInit));
        receiver.dispatchEvent(new MouseEvent("mouseover", mouseInit));
        receiver.dispatchEvent(new PointerEvent("pointerenter", pointerInit));
        receiver.dispatchEvent(new MouseEvent("mouseenter", mouseInit));
        receiver.dispatchEvent(new PointerEvent("pointermove", pointerInit));
        receiver.dispatchEvent(new MouseEvent("mousemove", mouseInit));
        receiver.dispatchEvent(new PointerEvent("pointerdown", pointerInit));
        receiver.dispatchEvent(new MouseEvent("mousedown", mouseInit));
        receiver.dispatchEvent(new PointerEvent("pointerup", pointerInit));
        receiver.dispatchEvent(new MouseEvent("mouseup", mouseInit));
        receiver.dispatchEvent(new MouseEvent("click", mouseInit));
        return true;
      };

      const walker = document.createTreeWalker(dialog, NodeFilter.SHOW_TEXT);
      let current: Node | null = walker.nextNode();
      while (current) {
        const text = normalize(current.textContent);
        if (text === "获取验证码") {
          const range = document.createRange();
          range.selectNodeContents(current);
          const rect = range.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            const hit = document.elementFromPoint(x, y) as HTMLElement | null;
            const clickable =
              hit?.closest<HTMLElement>("button, [role='button'], a, span, div") ??
              current.parentElement?.closest<HTMLElement>("button, [role='button'], a, span, div") ??
              current.parentElement ??
              null;
            if (clickable && dispatchClickSequence(clickable)) {
              return true;
            }
          }
        }
        current = walker.nextNode();
      }

      const countdownPattern = new RegExp(countdownPatternSource);
      return countdownPattern.test(dialog.textContent || "");
    }, verificationCodeRequestedPattern.source)
    .catch(() => false);

  if (!clickedInDialog) {
    const fallback = page.getByText("获取验证码", { exact: true }).last();
    const visible = await fallback.isVisible().catch(() => false);
    if (visible) {
      const box = await fallback.boundingBox().catch(() => null);
      if (box) {
        await clickPagePoint(page, box.x + box.width / 2, box.y + box.height / 2);
      }
    }
  }

  return page
    .waitForFunction((patternSource) => {
      const text = (document.body.textContent || "").replace(/\s+/g, " ");
      return new RegExp(patternSource).test(text);
    }, verificationCodeRequestedPattern.source, { timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
}

async function clickPagePoint(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.move(x, y, { steps: 8 });
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.up();
}

async function fillVerificationCode(page: Page, code: string): Promise<boolean> {
  const dialogs = page.locator("[role='dialog'], .semi-modal, .auxo-modal, .auxo-drawer");
  const count = await dialogs.count();

  for (let index = 0; index < count; index += 1) {
    const dialog = dialogs.nth(index);
    const visible = await dialog.isVisible().catch(() => false);
    if (!visible) {
      continue;
    }

    for (const selector of verificationCodeInputSelectors) {
      const input = dialog.locator(selector).first();
      const inputVisible = await input.isVisible().catch(() => false);
      if (!inputVisible) {
        continue;
      }

      await input.fill(code);
      return true;
    }
  }

  return fillFirstVisible(page, verificationCodeInputSelectors, code);
}

async function submitVerificationDialog(page: Page): Promise<boolean> {
  const dialogs = page.locator("[role='dialog'], .semi-modal, .auxo-modal, .auxo-drawer");
  const count = await dialogs.count();

  for (let index = 0; index < count; index += 1) {
    const dialog = dialogs.nth(index);
    const visible = await dialog.isVisible().catch(() => false);
    if (!visible) {
      continue;
    }

    const button = dialog.getByText("验证", { exact: true }).first();
    const buttonVisible = await button.isVisible().catch(() => false);
    const buttonEnabled = await button.isEnabled().catch(() => false);

    if (buttonVisible && buttonEnabled) {
      await button.click();
      return true;
    }
  }

  return clickFirstUsable(page, confirmVerificationSelectors).catch(() => false);
}

async function clickBottomPublishButton(page: Page): Promise<boolean> {
  const selectors = ["button", "[role='button']", "div[role='button']"];

  for (const selector of selectors) {
    const matches = page.locator(selector);
    const count = await matches.count();
    let bestIndex = -1;
    let bestY = -1;

    for (let index = 0; index < count; index += 1) {
      const locator = matches.nth(index);
      const visible = await locator.isVisible().catch(() => false);
      const enabled = await locator.isEnabled().catch(() => false);
      if (!visible || !enabled) {
        continue;
      }

      const text = ((await locator.textContent().catch(() => "")) || "").replace(/\s+/g, " ").trim();
      if (text !== "发布" && text !== "立即发布") {
        continue;
      }

      const box = await locator.boundingBox().catch(() => null);
      const y = box ? box.y + box.height : -1;
      if (y > bestY) {
        bestY = y;
        bestIndex = index;
      }
    }

    if (bestIndex >= 0) {
      await matches.nth(bestIndex).click();
      return true;
    }
  }

  return page
    .evaluate(() => {
      const candidates = Array.from(document.querySelectorAll<HTMLElement>("button, [role='button'], div[role='button']"));
      const visible = candidates
        .filter((node) => {
          const text = (node.textContent || "").replace(/\s+/g, " ").trim();
          if (text !== "发布" && text !== "立即发布") {
            return false;
          }

          const style = window.getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
        })
        .sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);

      const target = visible[0];
      if (!target) {
        return false;
      }

      target.click();
      return true;
    })
    .catch(() => false);
}
