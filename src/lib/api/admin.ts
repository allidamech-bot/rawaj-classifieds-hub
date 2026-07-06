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

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  if (!payload.expectedUpdatedAt) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "يجب توفير توقيت التحديث المتوقع من الإعلان المحمّل.",
      },
    };
  }

  const updatePayload = {
    status: payload.status,
    reviewed_by: payload.reviewerId,
    reviewed_at: new Date().toISOString(),
    rejection_reason:
      payload.status === "rejected" ? (payload.rejectionReason ?? "مرفوض من لوحة الإدارة") : null,
    published_at: payload.status === "approved" ? new Date().toISOString() : null,
    archived_at: payload.status === "archived" ? new Date().toISOString() : null,
  };

  const { data, error } = await clientResult.data
    .from("listings")
    .update(updatePayload)
    .eq("id", payload.listingId)
    .eq("status", "pending_review")
    .eq("updated_at", payload.expectedUpdatedAt)
    .select("id, owner_id, title");

  if (error) return { ok: false, error: mapError(error) };
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: {
        code: "stale_review",
        message: "تغيّر الإعلان منذ فتحه للمراجعة. حدّث الصفحة وراجعه من جديد.",
      },
    };
  }

  const existing: Record<string, unknown> = {
    id: data[0].id,
    owner_id: data[0].owner_id,
    title: data[0].title,
  };

  const notificationResult = await createListingModerationNotification(
    clientResult.data,
    existing,
    payload,
  );
  if (!notificationResult.ok) {
    console.warn("Listing moderation succeeded but notification creation failed.", {
      listingId: payload.listingId,
      error: notificationResult.error.message,
    });
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
