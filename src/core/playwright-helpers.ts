import type { Locator, Page } from "playwright";

export async function firstVisibleLocator(page: Page, selectors: string[]): Promise<Locator | null> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();

    if ((await locator.count()) > 0 && (await locator.isVisible().catch(() => false))) {
      return locator;
    }
  }

  return null;
}

export async function clickFirstVisible(page: Page, selectors: string[]): Promise<boolean> {
  const locator = await firstVisibleLocator(page, selectors);

  if (!locator) {
    return false;
  }

  await locator.click();
  return true;
}

export async function fillFirstVisible(page: Page, selectors: string[], value: string): Promise<boolean> {
  const locator = await firstVisibleLocator(page, selectors);

  if (!locator) {
    return false;
  }

  await locator.fill(value);
  return true;
}

export async function setFilesOnFirstInput(page: Page, files: string[]): Promise<boolean> {
  const fileInputs = page.locator("input[type='file']");
  const count = await fileInputs.count();

  if (count === 0) {
    return false;
  }

  await fileInputs.first().setInputFiles(files);
  return true;
}

export async function hasAnyVisible(page: Page, selectors: string[]): Promise<boolean> {
  return (await firstVisibleLocator(page, selectors)) !== null;
}

export async function safeGoto(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
}

export async function clickElementContainingText(page: Page, text: string): Promise<boolean> {
  return page.evaluate((needle) => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("*"));
    const match = nodes.find((node) => (node.textContent || "").replace(/\s+/g, " ").trim() === needle);

    if (!match) {
      return false;
    }

    match.click();
    return true;
  }, text);
}
