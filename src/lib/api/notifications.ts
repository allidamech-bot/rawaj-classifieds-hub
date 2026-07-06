import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassifiedsResult, NotificationItem } from "@/lib/classifieds-types";
import { getClient, mapError, rowNullableString, rowRecord, rowString } from "@/lib/api/shared";

export async function fetchMyNotifications(
  userId: string | null,
): Promise<ClassifiedsResult<NotificationItem[]>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض الإشعارات." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("notifications")
    .select("*")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Record<string, unknown>[]).map(mapNotification) };
}

export async function fetchUnreadNotificationsCount(
  userId: string | null,
): Promise<ClassifiedsResult<number>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض الإشعارات." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { count, error } = await clientResult.data
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .is("read_at", null);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: count ?? 0 };
}

export async function markNotificationRead(
  userId: string | null,
  notificationId: string,
): Promise<ClassifiedsResult<null>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتحديث الإشعارات." },
    };
  }

  if (!notificationId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإشعار." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_id", userId)
    .is("read_at", null);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

export async function markAllNotificationsRead(
  userId: string | null,
): Promise<ClassifiedsResult<null>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتحديث الإشعارات." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", userId)
    .is("read_at", null);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

function mapNotification(row: Record<string, unknown>): NotificationItem {
  return {
    id: rowString(row, "id"),
    recipientId: rowString(row, "recipient_id"),
    actorId: rowNullableString(row, "actor_id"),
    type: rowString(row, "type"),
    titleAr: rowString(row, "title_ar"),
    bodyAr: rowNullableString(row, "body_ar"),
    targetType: rowNullableString(row, "target_type"),
    targetId: rowNullableString(row, "target_id"),
    metadata: rowRecord(row, "metadata"),
    readAt: rowNullableString(row, "read_at"),
    createdAt: rowString(row, "created_at"),
  };
}
