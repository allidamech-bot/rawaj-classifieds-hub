import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassifiedsResult, ModerateListingPayload } from "@/lib/classifieds-types";
import { getClient, mapError, rowString } from "@/lib/api/shared";

export async function adminModerateListing(
  canUseAdminAccess: boolean,
  payload: ModerateListingPayload,
): Promise<ClassifiedsResult<null>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "مراجعة الإعلانات متاحة لحساب إداري مخول فقط." },
    };
  }

  if (!payload.listingId.trim() || !payload.reviewerId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان أو حساب المراجع." },
    };
  }

  if (payload.status === "rejected" && !payload.rejectionReason?.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل سبب الرفض قبل تحديث الإعلان." },
    };
  }

  if (!payload.expectedUpdatedAt) {
    return {
      ok: false,
      error: { code: "validation_error", message: "حدّث الإعلان قبل اتخاذ قرار المراجعة." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data.rpc("rawaj_review_listing_decision", {
    p_listing_id: payload.listingId.trim(),
    p_decision: payload.status,
    p_reason:
      payload.status === "rejected"
        ? payload.rejectionReason?.trim()
        : "Approved after complete listing review",
    p_expected_updated_at: payload.expectedUpdatedAt,
  });

  if (error) {
    if (error.message?.includes("stale_review")) {
      return {
        ok: false,
        error: {
          code: "stale_review",
          message: "تغيّر الإعلان منذ فتحه للمراجعة. حدّث الصفحة وراجعه من جديد.",
        },
      };
    }
    return { ok: false, error: mapError(error) };
  }

  return { ok: true, data: null };
}

async function createListingModerationNotification(
  client: SupabaseClient,
  listing: Record<string, unknown>,
  payload: ModerateListingPayload,
): Promise<ClassifiedsResult<null>> {
  if (payload.status !== "approved" && payload.status !== "rejected") {
    return { ok: true, data: null };
  }

  const ownerId = rowString(listing, "owner_id");
  if (!ownerId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد صاحب الإعلان لإرسال الإشعار." },
    };
  }

  const listingTitle = rowString(listing, "title", "إعلانك");
  const rejected = payload.status === "rejected";
  const rejectionReason = payload.rejectionReason?.trim();

  const { error } = await client.rpc("rawaj_create_notification", {
    recipient_id: ownerId,
    notification_type: rejected ? "listing.rejected" : "listing.approved",
    title_ar: rejected ? "تم رفض إعلانك" : "تمت الموافقة على إعلانك",
    body_ar: rejected
      ? rejectionReason
        ? `تم رفض إعلان "${listingTitle}". السبب: ${rejectionReason}`
        : `تم رفض إعلان "${listingTitle}".`
      : `تمت الموافقة على إعلان "${listingTitle}" وأصبح جاهزاً للظهور.`,
    target_type: "listing",
    target_id: payload.listingId,
    metadata: {
      listing_id: payload.listingId,
      status: payload.status,
    },
  });

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}
