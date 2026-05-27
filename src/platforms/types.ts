import type {
  CreateImagePostDraftInput,
  CreateVideoPostDraftInput,
  Platform
} from "../core/schemas.js";

export type LoginStatusResult = {
  platform: Platform;
  loggedIn: boolean;
  message: string;
};

export type OpenLoginPageResult = {
  platform: Platform;
  opened: boolean;
  message: string;
};

export type PostDraftResult = {
  platform: Platform;
  status: "draft_created" | "published" | "login_required" | "failed";
  message: string;
};

export type CreateImagePostDraftResult = PostDraftResult;
export type CreateVideoPostDraftResult = PostDraftResult;

export type PlatformCapabilities = {
  imagePostDraft?: true;
  videoPostDraft?: true;
  articlePostDraft?: true;
};

export type PlatformAdapter = {
  platform: Platform;
  capabilities: PlatformCapabilities;
  checkLoginStatus(): Promise<LoginStatusResult>;
  openLoginPage(): Promise<OpenLoginPageResult>;
  createImagePostDraft?(input: CreateImagePostDraftInput): Promise<CreateImagePostDraftResult>;
  createVideoPostDraft?(input: CreateVideoPostDraftInput): Promise<CreateVideoPostDraftResult>;
};
