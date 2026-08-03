import type { Locator, Page } from "playwright";
import { clickFirstUsable, firstVisibleLocator } from "./playwright-helpers.js";
import type { PreparedArticleImage } from "./markdown-article.js";

export async function importMarkdownFile(
  page: Page,
  markdownPath: string,
  importButtonSelectors: string[]
): Promise<boolean> {
  await clickFirstUsable(page, importButtonSelectors).catch(() => false);
  await page.waitForTimeout(500);
  return setFileOnMatchingInput(page, markdownPath, [".md", ".markdown", "text/markdown"]);
}

export async function setFileOnMatchingInput(
  page: Page,
  filePath: string,
  acceptFragments: string[]
): Promise<boolean> {
  const inputs = page.locator("input[type='file']");
  const count = await inputs.count();

  for (let index = count - 1; index >= 0; index -= 1) {
    const input = inputs.nth(index);
    const accept = ((await input.getAttribute("accept").catch(() => null)) || "").toLowerCase();
    if (acceptFragments.length === 0 || acceptFragments.some((fragment) => accept.includes(fragment))) {
      return input
        .setInputFiles(filePath)
        .then(() => true)
        .catch(() => false);
    }
  }

  if (count === 1) {
    return inputs
      .first()
      .setInputFiles(filePath)
      .then(() => true)
      .catch(() => false);
  }

  return false;
}

export async function fillRichEditorHtml(
  page: Page,
  editorSelectors: string[],
  html: string
): Promise<boolean> {
  const editor = await firstVisibleLocator(page, editorSelectors);
  if (!editor) {
    return false;
  }

  return editor
    .evaluate((node, value) => {
      const element = node as HTMLElement;
      element.focus();
      element.innerHTML = value;
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: null }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, html)
    .catch(() => false);
}

export async function replaceImageMarkers(
  page: Page,
  editorSelectors: string[],
  imageButtonSelectors: string[],
  images: PreparedArticleImage[],
  options: {
    keyboardShortcut?: string;
    openUploadBeforeSelect?: boolean;
    skipUploadTrigger?: boolean;
    uploadConfirmSelectors?: string[];
    uploadReadyPattern?: RegExp;
  } = {}
): Promise<{ replaced: number; failedMarker?: string }> {
  let replaced = 0;

  for (const image of images) {
    if (options.openUploadBeforeSelect) {
      const opened = await clickFirstUsable(page, imageButtonSelectors).catch(() => false);
      if (!opened) {
        return { replaced, failedMarker: image.marker };
      }
      await page.waitForTimeout(300);
    }

    const selected = await selectMarker(page, editorSelectors, image.marker);
    if (!selected) {
      return { replaced, failedMarker: image.marker };
    }

    const uploaded = options.skipUploadTrigger
      ? await setFileOnMatchingInput(page, image.path, ["image/", ".png", ".jpg", ".jpeg", ".webp"])
      : options.keyboardShortcut
        ? await uploadWithShortcut(page, options.keyboardShortcut, image.path)
        : await uploadWithButton(page, imageButtonSelectors, image.path);
    if (!uploaded) {
      return { replaced, failedMarker: image.marker };
    }

    if (options.uploadReadyPattern) {
      const ready = await waitForBodyPattern(page, options.uploadReadyPattern, 30_000);
      if (!ready) {
        return { replaced, failedMarker: image.marker };
      }
    }

    if (options.uploadConfirmSelectors?.length) {
      const confirmed = await waitAndClickFirstUsable(page, options.uploadConfirmSelectors, 30_000);
      if (!confirmed) {
        return { replaced, failedMarker: image.marker };
      }
    }

    const markerRemoved = await waitForMarkerRemoval(page, editorSelectors, image.marker, 30_000);
    if (!markerRemoved) {
      return { replaced, failedMarker: image.marker };
    }
    replaced += 1;
  }

  return { replaced };
}

async function waitAndClickFirstUsable(page: Page, selectors: string[], timeout: number): Promise<boolean> {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const clicked = await clickFirstUsable(page, selectors).catch(() => false);
    if (clicked) {
      return true;
    }
    await page.waitForTimeout(500);
  }

  return false;
}

async function uploadWithButton(page: Page, buttonSelectors: string[], imagePath: string): Promise<boolean> {
  const clicked = await clickFirstUsable(page, buttonSelectors).catch(() => false);
  if (!clicked) {
    return false;
  }

  await page.waitForTimeout(500);
  return setFileOnMatchingInput(page, imagePath, ["image/", ".png", ".jpg", ".jpeg", ".webp"]);
}

async function uploadWithShortcut(page: Page, shortcut: string, imagePath: string): Promise<boolean> {
  const chooserPromise = page.waitForEvent("filechooser", { timeout: 5_000 }).catch(() => null);
  await page.keyboard.press(shortcut);
  const chooser = await chooserPromise;

  if (chooser) {
    return chooser
      .setFiles(imagePath)
      .then(() => true)
      .catch(() => false);
  }

  return setFileOnMatchingInput(page, imagePath, ["image/", ".png", ".jpg", ".jpeg", ".webp"]);
}

export async function clickSaveAndConfirm(
  page: Page,
  saveButtonSelectors: string[],
  successPattern: RegExp,
  timeout = 20_000
): Promise<boolean> {
  const clicked = await clickFirstUsable(page, saveButtonSelectors).catch(() => false);
  if (!clicked) {
    return waitForBodyPattern(page, successPattern, 5_000);
  }

  return waitForBodyPattern(page, successPattern, timeout);
}

export async function waitForBodyPattern(page: Page, pattern: RegExp, timeout: number): Promise<boolean> {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const matched = await page
      .evaluate((source) => new RegExp(source).test((document.body.textContent || "").replace(/\s+/g, " ")), pattern.source)
      .catch(() => false);
    if (matched) {
      return true;
    }
    await page.waitForTimeout(500);
  }

  return false;
}

async function selectMarker(page: Page, editorSelectors: string[], marker: string): Promise<boolean> {
  for (const selector of editorSelectors) {
    const matches = page.locator(selector);
    const count = await matches.count();

    for (let index = 0; index < count; index += 1) {
      const editor = matches.nth(index);
      if (!(await editor.isVisible().catch(() => false))) {
        continue;
      }

      const selected = await selectMarkerInLocator(editor, marker);
      if (selected) {
        return true;
      }
    }
  }

  return false;
}

async function selectMarkerInLocator(editor: Locator, marker: string): Promise<boolean> {
  return editor
    .evaluate((node, needle) => {
      const element = node as HTMLElement | HTMLInputElement | HTMLTextAreaElement;

      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        const start = element.value.indexOf(needle);
        if (start < 0) {
          return false;
        }
        element.focus();
        element.setSelectionRange(start, start + needle.length);
        return true;
      }

      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let textNode = walker.nextNode();
      while (textNode) {
        const value = textNode.textContent || "";
        const start = value.indexOf(needle);
        if (start >= 0) {
          const range = document.createRange();
          range.setStart(textNode, start);
          range.setEnd(textNode, start + needle.length);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
          element.focus();
          return true;
        }
        textNode = walker.nextNode();
      }

      return false;
    }, marker)
    .catch(() => false);
}

async function waitForMarkerRemoval(
  page: Page,
  editorSelectors: string[],
  marker: string,
  timeout: number
): Promise<boolean> {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    let stillPresent = false;
    for (const selector of editorSelectors) {
      const matches = page.locator(selector);
      const count = await matches.count();
      for (let index = 0; index < count; index += 1) {
        const text = await matches
          .nth(index)
          .evaluate((node) => {
            if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
              return node.value;
            }
            return node.textContent || "";
          })
          .catch(() => "");
        if (text.includes(marker)) {
          stillPresent = true;
          break;
        }
      }
      if (stillPresent) {
        break;
      }
    }

    if (!stillPresent) {
      return true;
    }
    await page.waitForTimeout(500);
  }

  return false;
}
