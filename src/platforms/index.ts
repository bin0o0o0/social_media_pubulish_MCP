import type { Platform } from "../core/schemas.js";
import { douyinAdapter } from "./douyin.js";
import type { PlatformAdapter } from "./types.js";
import { xiaohongshuAdapter } from "./xiaohongshu.js";

const adapters: Record<Platform, PlatformAdapter> = {
  xiaohongshu: xiaohongshuAdapter,
  douyin: douyinAdapter
};

export function getPlatformAdapter(platform: Platform): PlatformAdapter {
  const adapter = adapters[platform];

  if (!adapter) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  return adapter;
}
