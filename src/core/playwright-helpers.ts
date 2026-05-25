import type { Locator, Page } from "playwright";

export async function firstVisibleLocator(page: Page, selectors: string[]): Promise<Locator | null> {
  for (const selector of selectors) {
    const matches = page.locator(selector);
    const count = await matches.count();

    for (let index = 0; index < count; index += 1) {
      const locator = matches.nth(index);

      if (await locator.isVisible().catch(() => false)) {
        return locator;
      }
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

export async function clickFirstUsable(page: Page, selectors: string[]): Promise<boolean> {
  for (const selector of selectors) {
    const matches = page.locator(selector);
    const count = await matches.count();

    for (let index = 0; index < count; index += 1) {
      const locator = matches.nth(index);
      const visible = await locator.isVisible().catch(() => false);
      const enabled = await locator.isEnabled().catch(() => false);

      if (visible && enabled) {
        await locator.click();
        return true;
      }
    }
  }

  return false;
}

export async function fillFirstVisible(page: Page, selectors: string[], value: string): Promise<boolean> {
  const locator = await firstVisibleLocator(page, selectors);

  if (!locator) {
    return false;
  }

  await locator.fill(value);
  return true;
}

export async function waitForAnyVisible(
  page: Page,
  selectors: string[],
  timeout = 30_000
): Promise<boolean> {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    if (await hasAnyVisible(page, selectors)) {
      return true;
    }

    await page.waitForTimeout(500);
  }

  return false;
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
