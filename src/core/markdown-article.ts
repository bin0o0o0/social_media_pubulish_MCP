import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { existsSync } from "node:fs";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { visit } from "unist-util-visit";

const supportedImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const remoteImagePattern = /^https?:\/\//i;

export type PreparedArticleImage = {
  marker: string;
  path: string;
  alt: string;
};

export type PreparedMarkdownArticle = {
  normalizedMarkdownPath: string;
  html: string;
  images: PreparedArticleImage[];
  warnings: string[];
  plainText: string;
  cleanup(): Promise<void>;
};

export async function prepareMarkdownArticle(markdownPath: string): Promise<PreparedMarkdownArticle> {
  const source = await readFile(markdownPath, "utf8");
  const tree = unified().use(remarkParse).use(remarkGfm).parse(source);
  const images: PreparedArticleImage[] = [];
  const warnings: string[] = [];
  const textParts: string[] = [];
  const workingDirectory = await mkdtemp(join(tmpdir(), "social-media-article-"));

  try {
    visit(tree, (node, index, parent) => {
      if (node.type === "text" || node.type === "code" || node.type === "inlineCode") {
        const value = "value" in node && typeof node.value === "string" ? node.value : "";
        if (value) {
          textParts.push(value);
        }
      }

      if (node.type === "html") {
        warnings.push("Raw HTML is sanitized for WeChat and may render differently on other platforms.");
      }

      if (node.type === "code" && "lang" in node && node.lang === "mermaid") {
        warnings.push("Mermaid blocks are preserved as code and are not rendered as diagrams.");
      }

      if (node.type !== "image" || index === undefined || !parent || !("children" in parent)) {
        return;
      }

      const url = node.url.trim();
      if (remoteImagePattern.test(url)) {
        warnings.push(`Remote image is kept as-is and may be rejected by the platform: ${url}`);
        return;
      }

      if (/^(data|file):/i.test(url)) {
        throw new Error(`unsupported Markdown image URL: ${url}`);
      }

      const decodedPath = decodeURIComponent(url);
      const imagePath = isAbsolute(decodedPath)
        ? decodedPath
        : resolve(dirname(markdownPath), decodedPath);
      const extension = extname(imagePath).toLowerCase();

      if (!supportedImageExtensions.has(extension)) {
        throw new Error(`unsupported Markdown image extension: ${extension || "(none)"}`);
      }
      if (!existsSync(imagePath)) {
        throw new Error(`Markdown image does not exist: ${imagePath}`);
      }

      const marker = `SOCIALMEDIAIMAGE${String(images.length + 1).padStart(4, "0")}TOKEN`;
      images.push({ marker, path: imagePath, alt: node.alt || "" });
      parent.children[index] = { type: "text", value: marker };
    });

    if (/\$\$[\s\S]+?\$\$/.test(source)) {
      warnings.push("Display math is not guaranteed to render consistently across platforms.");
    }

    const normalizedMarkdown = unified().use(remarkGfm).use(remarkStringify).stringify(tree);
    const normalizedMarkdownPath = join(workingDirectory, "article.md");
    await writeFile(normalizedMarkdownPath, normalizedMarkdown, "utf8");

    const html = String(
      await unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkRehype)
        .use(rehypeSanitize)
        .use(rehypeStringify)
        .process(normalizedMarkdown)
    );

    return {
      normalizedMarkdownPath,
      html,
      images,
      warnings: [...new Set(warnings)],
      plainText: textParts.join(" ").replace(/\s+/g, " ").trim(),
      cleanup: () => rm(workingDirectory, { recursive: true, force: true })
    };
  } catch (error) {
    await rm(workingDirectory, { recursive: true, force: true });
    throw error;
  }
}
