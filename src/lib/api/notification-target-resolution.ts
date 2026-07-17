import { fetchListingDetail } from "@/lib/api/listings";
import { fetchMyConversations } from "@/lib/api/messaging";
import { fetchPublicSellerProfile } from "@/lib/api/seller";
import type { ClassifiedsResult, NotificationItem } from "@/lib/classifieds-types";
import { parseNotificationTargetReference } from "@/lib/notification-target-path";

export type ResolvedNotificationTarget =
  | { kind: "listing"; listingId: string }
  | { kind: "conversation"; conversationId: string }
  | { kind: "conversation_missing"; conversationId: string }
  | { kind: "seller"; sellerId: string }
  | { kind: "saved_search"; savedSearchId: string }
  | { kind: "browse_listings" };

export async function resolveNotificationTarget(
  notification: NotificationItem,
): Promise<ClassifiedsResult<ResolvedNotificationTarget | null>> {
  const reference = parseNotificationTargetReference(
    notification.targetType,
    notification.targetId,
  );
  if (!reference) return { ok: true, data: null };

  if (reference.kind === "listing") {
    const result = await fetchListingDetail(reference.id);
    if (result.ok) {
      return { ok: true, data: { kind: "listing", listingId: reference.id } };
    }
    if (result.error.code === "not_found") {
      return { ok: true, data: { kind: "browse_listings" } };
    }
    return result;
  }

  if (reference.kind === "conversation") {
    const result = await fetchMyConversations();
    if (!result.ok) return result;
    const exists = result.data.some((conversation) => conversation.id === reference.id);
    return {
      ok: true,
      data: exists
        ? { kind: "conversation", conversationId: reference.id }
        : { kind: "conversation_missing", conversationId: reference.id },
    };
  }

  if (reference.kind === "seller") {
    const result = await fetchPublicSellerProfile(reference.id);
    if (result.ok) return { ok: true, data: { kind: "seller", sellerId: reference.id } };
    if (result.error.code === "not_found") {
      return { ok: true, data: { kind: "browse_listings" } };
    }
    return result;
  }

  return {
    ok: true,
    data: { kind: "saved_search", savedSearchId: reference.id },
  };
}
