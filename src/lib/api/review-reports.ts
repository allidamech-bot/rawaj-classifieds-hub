import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { getClient, mapError, rowNullableString, rowString } from "@/lib/api/shared";
import { mapModerationError } from "@/lib/api/moderation-errors";
import { normalizeModerationText } from "@/lib/moderation-contract";

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

export async function createSellerReviewReport(
  reviewId: string,
  reason: SellerReviewReportReason,
  details?: string | null,
): Promise<ClassifiedsResult<SellerReviewReport>> {
  const cleanReviewId = reviewId.trim();
  const cleanDetails = normalizeModerationText(details ?? "", 1000) || null;

  if (!cleanReviewId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد التقييم." },
    };
  }

  if (
    !["abuse", "spam", "misleading", "personal_data", "prohibited_content", "other"].includes(
      reason,
    )
  ) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اختر سبب بلاغ صالحا." },
    };
  }

  if (cleanDetails && cleanDetails.length > 1000) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تفاصيل البلاغ يجب ألا تتجاوز 1000 حرف." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_create_seller_review_report", {
    p_review_id: cleanReviewId,
    p_reason: reason,
    p_details: cleanDetails,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("seller_review_report_auth_required")) {
      return {
        ok: false,
        error: { code: "auth_required", message: "يجب تسجيل الدخول للإبلاغ عن تقييم." },
      };
    }
    if (message.includes("seller_review_report_self_report_denied")) {
      return {
        ok: false,
        error: { code: "permission_denied", message: "لا يمكنك الإبلاغ عن تقييمك أنت." },
      };
    }
    if (message.includes("seller_review_report_review_unavailable")) {
      return {
        ok: false,
        error: { code: "not_found", message: "التقييم غير متاح للإبلاغ." },
      };
    }
    if (message.includes("seller_review_report_invalid_reason")) {
      return {
        ok: false,
        error: { code: "validation_error", message: "سبب البلاغ غير صالح." },
      };
    }
    return { ok: false, error: mapError(error) };
  }

  const raw = Array.isArray(data) ? data[0] : data;
  if (!raw || typeof raw !== "object") {
    return {
      ok: false,
      error: { code: "unknown", message: "تم إرسال البلاغ دون إعادة السجل المحفوظ." },
    };
  }

  return { ok: true, data: mapSellerReviewReport(raw as Record<string, unknown>) };
}

export async function adminFetchSellerReviewReports(): Promise<
  ClassifiedsResult<SellerReviewReport[]>
> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc(
    "rawaj_fetch_seller_review_reports_for_admin",
    { p_limit: 200 },
  );

  if (error) {
    return {
      ok: false,
      error: mapModerationError(
        error,
        "seller_review_report_admin_queue",
        "تعذر تحميل بلاغات التقييمات.",
      ),
    };
  }
  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map(mapSellerReviewReport),
  };
}

export async function adminModerateSellerReviewReport(payload: {
  reportId: string;
  status: SellerReviewReportStatus;
  adminNote?: string | null;
  expectedUpdatedAt: string;
}): Promise<ClassifiedsResult<null>> {
  if (!payload.reportId.trim() || !payload.expectedUpdatedAt) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد البلاغ أو نسخته الحالية." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data.rpc("rawaj_admin_moderate_seller_review_report", {
    p_report_id: payload.reportId.trim(),
    p_status: payload.status,
    p_admin_note: normalizeModerationText(payload.adminNote ?? "", 1000) || null,
    p_expected_updated_at: payload.expectedUpdatedAt,
  });

  if (error) {
    return {
      ok: false,
      error: mapModerationError(error, "seller_review_report_moderate", "تعذر تحديث بلاغ التقييم."),
    };
  }

  return { ok: true, data: null };
}

function mapSellerReviewReport(row: Record<string, unknown>): SellerReviewReport {
  return {
    id: rowString(row, "id"),
    reviewId: rowNullableString(row, "review_id"),
    reporterUserId: rowString(row, "reporter_user_id"),
    reportedReviewerUserId: rowString(row, "reported_reviewer_user_id"),
    reason: rowString(row, "reason", "other") as SellerReviewReportReason,
    details: rowNullableString(row, "details"),
    status: rowString(row, "status", "new") as SellerReviewReportStatus,
    adminNote: rowNullableString(row, "admin_note"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}
