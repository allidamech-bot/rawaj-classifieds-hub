import type { ClassifiedsErrorCode, ClassifiedsResult } from "@/lib/classifieds-types";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import { getTurnstileToken } from "@/lib/turnstile-client";

export type FeedbackType = "complaint" | "suggestion" | "technical_issue" | "other";
export type FeedbackStatus = "new" | "under_review" | "resolved" | "closed";
export type FeedbackPriority = "low" | "normal" | "high" | "urgent";

export interface FeedbackContext {
  path: string;
  url: string;
  viewportWidth: number;
  viewportHeight: number;
  language: "ar" | "en";
  theme: "light" | "dark";
  clientTimestamp: string;
  userAgent: string;
}

export interface FeedbackConfig {
  key?: "feedback_widget_enabled";
  enabled: boolean;
  reason?: string;
  version?: number;
  updatedBy?: string | null;
  updatedAt?: string;
}

export interface FeedbackItem {
  id: string;
  userId: string | null;
  email: string | null;
  type: FeedbackType;
  subject: string;
  message: string;
  context: Partial<FeedbackContext>;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  assignedTo: string | null;
  adminNote: string | null;
  publicResponse: string | null;
  createdAt: string;
  updatedAt: string;
}

const PUBLIC_CONFIG_TTL_MS = 15_000;
let publicConfigCache: { value: FeedbackConfig; expiresAt: number } | null = null;
let publicConfigRequest: Promise<ClassifiedsResult<FeedbackConfig>> | null = null;

export async function fetchFeedbackConfig(force = false): Promise<ClassifiedsResult<FeedbackConfig>> {
  if (!force && publicConfigCache && publicConfigCache.expiresAt > Date.now()) {
    return { ok: true, data: publicConfigCache.value };
  }
  if (!force && publicConfigRequest) return publicConfigRequest;

  const request = (async (): Promise<ClassifiedsResult<FeedbackConfig>> => {
    const result = fromApi(await cloudflareApiRequest<FeedbackConfig>("/v1/feedback/config"));
    if (result.ok) {
      publicConfigCache = { value: result.data, expiresAt: Date.now() + PUBLIC_CONFIG_TTL_MS };
    }
    return result;
  })();
  if (!force) publicConfigRequest = request;

  try {
    return await request;
  } finally {
    if (publicConfigRequest === request) publicConfigRequest = null;
  }
}

export function invalidateFeedbackConfigCache() {
  publicConfigCache = null;
  publicConfigRequest = null;
}

export async function submitFeedback(payload: {
  type: FeedbackType;
  subject: string;
  message: string;
  context: FeedbackContext;
}): Promise<ClassifiedsResult<FeedbackItem>> {
  let turnstileToken: string | null = null;
  try {
    turnstileToken = await getTurnstileToken("feedback_request");
  } catch {
    return {
      ok: false,
      error: {
        code: "unknown",
        message: "تعذر إكمال التحقق الأمني. حاول مرة أخرى.",
      },
    };
  }
  return fromApi(
    await cloudflareApiRequest<FeedbackItem>("/v1/feedback", {
      method: "POST",
      body: { ...payload, turnstileToken },
    }),
  );
}

export async function ownerFetchFeedbackConfig(
  canManageSystemSettings: boolean,
): Promise<ClassifiedsResult<Required<Pick<FeedbackConfig, "enabled" | "reason" | "version" | "updatedAt">> & FeedbackConfig>> {
  if (!canManageSystemSettings) return permissionDenied();
  return fromApi(
    await cloudflareApiRequest<
      Required<Pick<FeedbackConfig, "enabled" | "reason" | "version" | "updatedAt">> & FeedbackConfig
    >("/v1/admin/feedback/config"),
  );
}

export async function ownerSetFeedbackConfig(
  canManageSystemSettings: boolean,
  payload: { enabled: boolean; reason: string; expectedVersion: number },
): Promise<ClassifiedsResult<FeedbackConfig>> {
  if (!canManageSystemSettings) return permissionDenied();
  const reason = payload.reason.trim();
  if (reason.length < 3) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اكتب سبباً واضحاً قبل تغيير حالة الميزة." },
    };
  }
  const result = fromApi(
    await cloudflareApiRequest<FeedbackConfig>("/v1/admin/feedback/config", {
      method: "POST",
      body: { ...payload, reason },
    }),
  );
  if (result.ok) invalidateFeedbackConfigCache();
  return result;
}

export async function adminFetchFeedback(
  status?: FeedbackStatus | "all",
): Promise<ClassifiedsResult<FeedbackItem[]>> {
  const params = new URLSearchParams({ limit: "100" });
  if (status && status !== "all") params.set("status", status);
  return fromApi(await cloudflareApiRequest<FeedbackItem[]>(`/v1/admin/feedback?${params}`));
}

export async function adminUpdateFeedback(payload: {
  id: string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  adminNote: string | null;
  publicResponse: string | null;
  expectedUpdatedAt: string;
}): Promise<ClassifiedsResult<FeedbackItem>> {
  const id = payload.id.trim();
  if (!id) {
    return { ok: false, error: { code: "validation_error", message: "معرّف الملاحظة غير صالح." } };
  }
  return fromApi(
    await cloudflareApiRequest<FeedbackItem>(`/v1/admin/feedback/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: {
        status: payload.status,
        priority: payload.priority,
        adminNote: payload.adminNote,
        publicResponse: payload.publicResponse,
        expectedUpdatedAt: payload.expectedUpdatedAt,
      },
    }),
  );
}

function permissionDenied<T>(): ClassifiedsResult<T> {
  return {
    ok: false,
    error: { code: "permission_denied", message: "إدارة هذه الميزة متاحة للمالك فقط." },
  };
}

function fromApi<T>(
  result: { ok: true; data: T } | { ok: false; error: string; code: string },
): ClassifiedsResult<T> {
  return result.ok
    ? { ok: true, data: result.data }
    : {
        ok: false,
        error: { code: result.code as ClassifiedsErrorCode, message: result.error },
      };
}
