import { existsSync } from "node:fs";
import { extname } from "node:path";
import { z } from "zod";

const supportedImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export const platformSchema = z.enum(["xiaohongshu", "douyin"]);

export const checkLoginStatusInputSchema = z.object({
  platform: platformSchema
});

export const openLoginPageInputSchema = z.object({
  platform: platformSchema
});

export const createImagePostDraftInputSchema = z.object({
  platform: platformSchema,
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

export type Platform = z.infer<typeof platformSchema>;
export type CheckLoginStatusInput = z.infer<typeof checkLoginStatusInputSchema>;
export type OpenLoginPageInput = z.infer<typeof openLoginPageInputSchema>;
export type CreateImagePostDraftInput = z.infer<typeof createImagePostDraftInputSchema>;
