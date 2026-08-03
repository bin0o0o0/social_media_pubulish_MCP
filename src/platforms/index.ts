import type { Platform } from "../core/schemas.js";
import { csdnAdapter } from "./csdn.js";
import { douyinAdapter } from "./douyin.js";
import type { PlatformAdapter } from "./types.js";
import { wechatAdapter } from "./wechat.js";
import { xiaohongshuAdapter } from "./xiaohongshu.js";
import { zhihuAdapter } from "./zhihu.js";

const adapters: Record<Platform, PlatformAdapter> = {
  xiaohongshu: xiaohongshuAdapter,
  douyin: douyinAdapter,
  csdn: csdnAdapter,
  zhihu: zhihuAdapter,
  wechat: wechatAdapter
};

export function getPlatformAdapter(platform: Platform): PlatformAdapter {
  const adapter = adapters[platform];

  if (!adapter) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  return adapter;
}
