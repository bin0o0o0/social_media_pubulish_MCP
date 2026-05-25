import type { CreateImagePostDraftInput, Platform } from "../core/schemas.js";

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

export type CreateImagePostDraftResult = {
  platform: Platform;
  status: "draft_created" | "login_required" | "failed";
  message: string;
};

export type PlatformAdapter = {
  platform: Platform;
  checkLoginStatus(): Promise<LoginStatusResult>;
  openLoginPage(): Promise<OpenLoginPageResult>;
  createImagePostDraft(input: CreateImagePostDraftInput): Promise<CreateImagePostDraftResult>;
};
