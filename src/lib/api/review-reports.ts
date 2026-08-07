import type { ClassifiedsErrorCode, ClassifiedsResult } from "@/lib/classifieds-types";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import { normalizeModerationText } from "@/lib/moderation-contract";
import { getTurnstileToken } from "@/lib/turnstile-client";

export type SellerReviewReportReason =
  "abuse" | "spam" | "misleading" | "personal_data" | "prohibited_content" | "other";

export type SellerReviewReportStatus = "new" | "under_review" | "resolved" | "rejected";

export interface SellerReviewReport {
  id: string;
  reviewId: string | null;
  reporterUserId: string;
  reportedReviewerUserId: string;
  reason: SellerReviewReportReason;
  details: string | null;
  status: SellerReviewReportStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

const reportReasons = new Set<SellerReviewReportReason>([
  "abuse",
  "spam",
  "misleading",
  "personal_data",
  "prohibited_content",
  "other",
]);

export async function createSellerReviewReport(
  reviewId: string,
  reason: SellerReviewReportReason,
  details?: string | null,
): Promise<ClassifiedsResult<SellerReviewReport>> {
  const cleanReviewId = reviewId.trim();
  const cleanDetails = normalizeModerationText(details ?? "", 1000) || null;
  if (!cleanReviewId) {
    return { ok: false, error: { code: "validation_error", message: "تعذر تحديد التقييم." } };
  }
  if (!reportReasons.has(reason)) {
    return { ok: false, error: { code: "validation_error", message: "اختر سبب بلاغ صالحا." } };
  }

  const turnstile = await challengeToken("review_report");
  if (!turnstile.ok) return turnstile;

  const result = await cloudflareApiRequest<SellerReviewReport>(
    `/v1/reviews/${encodeURIComponent(cleanReviewId)}/reports`,
    {
      method: "POST",
      body: { reason, details: cleanDetails, turnstileToken: turnstile.data },
    },
  );
  return fromApi(result);
}

export async function adminFetchSellerReviewReports(): Promise<
  ClassifiedsResult<SellerReviewReport[]>
> {
  return fromApi(
    await cloudflareApiRequest<SellerReviewReport[]>("/v1/admin/seller-review-reports?limit=200"),
  );
}

export async function adminModerateSellerReviewReport(payload: {
  reportId: string;
  status: SellerReviewReportStatus;
  adminNote?: string | null;
  expectedUpdatedAt: string;
}): Promise<ClassifiedsResult<null>> {
  const reportId = payload.reportId.trim();
  if (!reportId || !payload.expectedUpdatedAt) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد البلاغ أو نسخته الحالية." },
    };
  }
  const result = await cloudflareApiRequest<{ success: boolean; updatedAt: string }>(
    `/v1/admin/seller-review-reports/${encodeURIComponent(reportId)}`,
    {
      method: "PATCH",
      body: {
        status: payload.status,
        adminNote: normalizeModerationText(payload.adminNote ?? "", 1000) || null,
        expectedUpdatedAt: payload.expectedUpdatedAt,
      },
    },
  );
  return result.ok
    ? { ok: true, data: null }
    : { ok: false, error: { code: result.code as ClassifiedsErrorCode, message: result.error } };
}

async function challengeToken(action: string): Promise<ClassifiedsResult<string | null>> {
  try {
    return { ok: true, data: await getTurnstileToken(action) };
  } catch {
    return {
      ok: false,
      error: {
        code: "turnstile_failed" as ClassifiedsErrorCode,
        message: "تعذر إكمال التحقق الأمني. حاول مرة أخرى.",
      },
    };
  }
}

function fromApi<T>(
  result: { ok: true; data: T } | { ok: false; error: string; code: string },
): ClassifiedsResult<T> {
  return result.ok
    ? { ok: true, data: result.data }
    : { ok: false, error: { code: result.code as ClassifiedsErrorCode, message: result.error } };
}
