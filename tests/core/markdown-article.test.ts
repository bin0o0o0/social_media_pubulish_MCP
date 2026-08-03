import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import { prepareMarkdownArticle } from "../../src/core/markdown-article.js";

describe("prepareMarkdownArticle", () => {
  test("normalizes local images and creates sanitized HTML", async () => {
    const dir = mkdirTestDir();
    const imageDir = join(dir, "images");
    mkdirSync(imageDir);
    const imagePath = join(imageDir, "cover.png");
    const secondImagePath = join(imageDir, "detail.png");
    const markdownPath = join(dir, "article.md");
    writeFileSync(imagePath, "fake png bytes");
    writeFileSync(secondImagePath, "different fake png bytes");
    writeFileSync(
      markdownPath,
      [
        "# Heading",
        "",
        "Paragraph with **bold** text.",
        "",
        "FIRST_IMAGE_ANCHOR_BEFORE",
        "",
        "![Cover](./images/cover.png)",
        "",
        "FIRST_IMAGE_ANCHOR_AFTER",
        "",
        "SECOND_IMAGE_ANCHOR_BEFORE",
        "",
        "![Detail](./images/detail.png)",
        "",
        "SECOND_IMAGE_ANCHOR_AFTER",
        "",
        "<script>alert('unsafe')</script>"
      ].join("\n")
    );

    const prepared = await prepareMarkdownArticle(markdownPath);
    expect(prepared.images).toEqual([
      {
        marker: "SOCIALMEDIAIMAGE0001TOKEN",
        path: imagePath,
        alt: "Cover"
      },
      {
        marker: "SOCIALMEDIAIMAGE0002TOKEN",
        path: secondImagePath,
        alt: "Detail"
      }
    ]);
    expect(prepared.html).toContain("<strong>bold</strong>");
    expectMarkersToRemainBetweenTheirAnchors(prepared.html);
    expect(prepared.html).not.toContain("<script>");
    expect(prepared.warnings).toContain(
      "Raw HTML is sanitized for WeChat and may render differently on other platforms."
    );
    expect(existsSync(prepared.normalizedMarkdownPath)).toBe(true);

    await prepared.cleanup();
    expect(existsSync(prepared.normalizedMarkdownPath)).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  test("keeps remote images and returns a warning", async () => {
    const dir = mkdirTestDir();
    const markdownPath = join(dir, "article.md");
    writeFileSync(markdownPath, "![Remote](https://example.com/image.png)");

    const prepared = await prepareMarkdownArticle(markdownPath);
    expect(prepared.images).toEqual([]);
    expect(prepared.html).toContain("https://example.com/image.png");
    expect(prepared.warnings[0]).toContain("Remote image is kept as-is");
    await prepared.cleanup();
    rmSync(dir, { recursive: true, force: true });
  });

  test("rejects missing local images", async () => {
    const dir = mkdirTestDir();
    const markdownPath = join(dir, "article.md");
    writeFileSync(markdownPath, "![Missing](./missing.png)");

    await expect(prepareMarkdownArticle(markdownPath)).rejects.toThrow("Markdown image does not exist");
    rmSync(dir, { recursive: true, force: true });
  });
});

function mkdirTestDir(): string {
  const dir = join(tmpdir(), `social-media-markdown-${crypto.randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function expectMarkersToRemainBetweenTheirAnchors(html: string): void {
  const positions = [
    html.indexOf("FIRST_IMAGE_ANCHOR_BEFORE"),
    html.indexOf("SOCIALMEDIAIMAGE0001TOKEN"),
    html.indexOf("FIRST_IMAGE_ANCHOR_AFTER"),
    html.indexOf("SECOND_IMAGE_ANCHOR_BEFORE"),
    html.indexOf("SOCIALMEDIAIMAGE0002TOKEN"),
    html.indexOf("SECOND_IMAGE_ANCHOR_AFTER")
  ];

  expect(positions.every((position) => position >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((left, right) => left - right));
}
