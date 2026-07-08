import { fetchListingDetail } from "@/lib/api/listings";
import { fetchMyConversations } from "@/lib/api/messaging";
import { fetchPublicSellerProfile } from "@/lib/api/seller";
import type {
  ClassifiedsResult,
  NotificationItem,
} from "@/lib/classifieds-types";

export type ResolvedNotificationTarget =
  | { kind: "listing"; listingId: string }
  | { kind: "conversation"; conversationId: string }
  | { kind: "conversation_missing"; conversationId: string }
  | { kind: "seller"; sellerId: string }
  | { kind: "browse_listings" };

export async function resolveNotificationTarget(
  userId: string | null,
  notification: NotificationItem,
): Promise<ClassifiedsResult<ResolvedNotificationTarget | null>> {
  const targetType = notification.targetType?.trim().toLowerCase() ?? "";
  const targetId = notification.targetId?.trim() ?? "";
  if (!targetType || !targetId) return { ok: true, data: null };

  if (targetType === "listing") {
    const result = await fetchListingDetail(targetId);
    if (result.ok) return { ok: true, data: { kind: "listing", listingId: targetId } };
    if (result.error.code === "not_found") {
      return { ok: true, data: { kind: "browse_listings" } };
    }
    return result;
  }

  if (targetType === "conversation") {
    const result = await fetchMyConversations(userId);
    if (!result.ok) return result;
    const exists = result.data.some((conversation) => conversation.id === targetId);
    return {
      ok: true,
      data: exists
        ? { kind: "conversation", conversationId: targetId }
        : { kind: "conversation_missing", conversationId: targetId },
    };
  }

  if (targetType === "seller") {
    const result = await fetchPublicSellerProfile(targetId);
    if (result.ok) return { ok: true, data: { kind: "seller", sellerId: targetId } };
    if (result.error.code === "not_found") {
      return { ok: true, data: { kind: "browse_listings" } };
    }
    return result;
  }

  return { ok: true, data: null };
}
