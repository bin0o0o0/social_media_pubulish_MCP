import type {
  CreateImagePostDraftInput,
  CreateVideoPostDraftInput,
  Platform,
  SubmitVerificationCodeInput
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
  status: "draft_created" | "login_required" | "verification_required" | "failed";
  message: string;
};

export type CreateImagePostDraftResult = PostDraftResult;
export type CreateVideoPostDraftResult = PostDraftResult;

export type SubmitVerificationCodeResult = {
  platform: Platform;
  status: "verified" | "failed";
  message: string;
};

export type PlatformCapabilities = {
  imagePostDraft?: true;
  videoPostDraft?: true;
  articlePostDraft?: true;
  verificationCodeSubmission?: true;
};

export type PlatformAdapter = {
  platform: Platform;
  capabilities: PlatformCapabilities;
  checkLoginStatus(): Promise<LoginStatusResult>;
  openLoginPage(): Promise<OpenLoginPageResult>;
  createImagePostDraft?(input: CreateImagePostDraftInput): Promise<CreateImagePostDraftResult>;
  createVideoPostDraft?(input: CreateVideoPostDraftInput): Promise<CreateVideoPostDraftResult>;
  submitVerificationCode?(input: SubmitVerificationCodeInput): Promise<SubmitVerificationCodeResult>;
};
