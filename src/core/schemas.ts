import { existsSync } from "node:fs";
import { extname } from "node:path";
import { z } from "zod";

const supportedImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const supportedVideoExtensions = new Set([".mp4", ".mov", ".m4v"]);
const supportedMarkdownExtensions = new Set([".md", ".markdown"]);
const coverOrientationSchema = z.enum(["vertical", "horizontal"]);

export const platformSchema = z.enum(["xiaohongshu", "douyin", "csdn", "zhihu", "wechat"]);
export const imagePostPlatformSchema = z.enum(["xiaohongshu", "douyin"]);
export const articlePostPlatformSchema = z.enum(["csdn", "zhihu", "wechat"]);

export const checkLoginStatusInputSchema = z.object({
  platform: platformSchema
});

export const openLoginPageInputSchema = z.object({
  platform: platformSchema
});

export const submitVerificationCodeInputSchema = z.object({
  platform: z.literal("douyin"),
  code: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, "verification code must be 4 to 8 digits")
});

export const createImagePostDraftInputSchema = z.object({
  platform: imagePostPlatformSchema,
  title: z.string().trim().min(1, "title is required"),
  content: z.string().trim().min(1, "content is required"),
  images: z
    .array(z.string().trim().min(1, "image path is required"))
    .min(1, "at least one image is required")
    .superRefine((images, ctx) => {
      images.forEach((imagePath, index) => {
        const extension = extname(imagePath).toLowerCase();

        if (!supportedImageExtensions.has(extension)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `unsupported image extension: ${extension || "(none)"}`,
            path: [index]
          });
        }

        if (!existsSync(imagePath)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `image does not exist: ${imagePath}`,
            path: [index]
          });
        }
      });
    }),
  tags: z.array(z.string().trim().min(1)).optional()
});

export const createVideoPostDraftInputSchema = z.object({
  platform: z.literal("douyin"),
  title: z.string().trim().min(1, "title is required"),
  content: z.string().trim().min(1, "content is required"),
  video: z
    .string()
    .trim()
    .min(1, "video path is required")
    .superRefine((videoPath, ctx) => {
      const extension = extname(videoPath).toLowerCase();

      if (!supportedVideoExtensions.has(extension)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `unsupported video extension: ${extension || "(none)"}`
        });
      }

      if (!existsSync(videoPath)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `video does not exist: ${videoPath}`
        });
      }
    }),
  coverImage: z
    .string()
    .trim()
    .min(1, "cover image path is required")
    .superRefine((imagePath, ctx) => {
      const extension = extname(imagePath).toLowerCase();

      if (!supportedImageExtensions.has(extension)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `unsupported image extension: ${extension || "(none)"}`
        });
      }

      if (!existsSync(imagePath)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `image does not exist: ${imagePath}`
        });
      }
    })
    .optional(),
  coverOrientation: coverOrientationSchema.default("vertical").optional(),
  tags: z.array(z.string().trim().min(1)).optional()
});

export const createArticlePostDraftInputSchema = z
  .object({
    platform: articlePostPlatformSchema,
    title: z.string().trim().min(1, "title is required"),
    markdownPath: z
      .string()
      .trim()
      .min(1, "markdown path is required")
      .superRefine((markdownPath, ctx) => {
        const extension = extname(markdownPath).toLowerCase();

        if (!supportedMarkdownExtensions.has(extension)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `unsupported markdown extension: ${extension || "(none)"}`
          });
        }

        if (!existsSync(markdownPath)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `markdown file does not exist: ${markdownPath}`
          });
        }
      }),
    coverImage: z
      .string()
      .trim()
      .min(1, "cover image path is required")
      .superRefine((imagePath, ctx) => {
        const extension = extname(imagePath).toLowerCase();

        if (!supportedImageExtensions.has(extension)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `unsupported image extension: ${extension || "(none)"}`
          });
        }

        if (!existsSync(imagePath)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `image does not exist: ${imagePath}`
          });
        }
      })
      .optional(),
    tags: z.array(z.string().trim().min(1)).optional(),
    category: z.string().trim().min(1, "category cannot be empty").optional()
  })
  .superRefine((input, ctx) => {
    if (input.platform === "wechat" && !input.coverImage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cover image is required for WeChat articles",
        path: ["coverImage"]
      });
    }
  });

export type Platform = z.infer<typeof platformSchema>;
export type ArticlePostPlatform = z.infer<typeof articlePostPlatformSchema>;
export type CheckLoginStatusInput = z.infer<typeof checkLoginStatusInputSchema>;
export type OpenLoginPageInput = z.infer<typeof openLoginPageInputSchema>;
export type SubmitVerificationCodeInput = z.infer<typeof submitVerificationCodeInputSchema>;
export type CreateImagePostDraftInput = z.infer<typeof createImagePostDraftInputSchema>;
export type CreateVideoPostDraftInput = z.infer<typeof createVideoPostDraftInputSchema>;
export type CreateArticlePostDraftInput = z.infer<typeof createArticlePostDraftInputSchema>;
export type CoverOrientation = z.infer<typeof coverOrientationSchema>;
