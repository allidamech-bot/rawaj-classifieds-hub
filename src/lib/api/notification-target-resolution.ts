import { fetchMyNotificationById } from "@/lib/api/notifications";
import { fetchListingDetail } from "@/lib/api/listings";
import { fetchMyConversations } from "@/lib/api/messaging";
import { fetchPublicSellerProfile } from "@/lib/api/seller";
import { fetchMySupportRequest } from "@/lib/api/support";
import { getAuthenticatedUserId, getClient, mapError } from "@/lib/api/shared";
import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { parseNotificationTargetReference } from "@/lib/notification-target-path";

export type ResolvedNotificationTarget =
  | { kind: "listing"; listingId: string }
  | { kind: "owner_listing"; listingId: string }
  | { kind: "conversation"; conversationId: string }
  | { kind: "seller"; sellerId: string }
  | { kind: "saved_search"; savedSearchId: string }
  | { kind: "support" }
  | { kind: "verification" }
  | { kind: "promotion" }
  | { kind: "browse_listings" };

export async function resolveNotificationTarget(
  notificationId: string,
): Promise<ClassifiedsResult<ResolvedNotificationTarget | null>> {
  const notificationResult = await fetchMyNotificationById(notificationId);
  if (!notificationResult.ok) return notificationResult;
  const notification = notificationResult.data;
  if (!notification) return { ok: true, data: null };

  const reference = parseNotificationTargetReference(
    notification.targetType,
    notification.targetId,
  );
  if (!reference) return { ok: true, data: null };

  if (
    reference.kind === "owner_listing" ||
    (reference.kind === "listing" && isOwnerListingNotification(notification.type))
  ) {
    return resolveOwnedListing(reference.id);
  }

  if (reference.kind === "listing") {
    const result = await fetchListingDetail(reference.id);
    if (result.ok) return { ok: true, data: { kind: "listing", listingId: reference.id } };
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
      data: exists ? { kind: "conversation", conversationId: reference.id } : null,
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

  if (reference.kind === "saved_search") {
    const owned = await currentAccountOwns("saved_searches", reference.id);
    if (!owned.ok) return owned;
    return {
      ok: true,
      data: owned.data ? { kind: "saved_search", savedSearchId: reference.id } : null,
    };
  }

  if (reference.kind === "support") {
    const owned = await fetchMySupportRequest(reference.id);
    if (!owned.ok) return owned;
    return { ok: true, data: owned.data ? { kind: "support" } : null };
  }

  if (reference.kind === "verification") return { ok: true, data: { kind: "verification" } };
  if (reference.kind === "promotion") return { ok: true, data: { kind: "promotion" } };
  return { ok: true, data: null };
}

async function resolveOwnedListing(
  listingId: string,
): Promise<ClassifiedsResult<ResolvedNotificationTarget | null>> {
  const owned = await currentAccountOwns("listings", listingId, "owner_id");
  if (!owned.ok) return owned;
  return {
    ok: true,
    data: owned.data ? { kind: "owner_listing", listingId } : null,
  };
}

async function currentAccountOwns(
  table: "listings" | "saved_searches",
  resourceId: string,
  ownerColumn = "user_id",
): Promise<ClassifiedsResult<boolean>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const actorResult = await getAuthenticatedUserId(clientResult.data);
  if (!actorResult.ok) return actorResult;
  const { data, error } = await clientResult.data
    .from(table)
    .select("id")
    .eq("id", resourceId)
    .eq(ownerColumn, actorResult.data)
    .maybeSingle();
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: Boolean(data) };
}

function isOwnerListingNotification(type: string): boolean {
  const normalized = type.trim().toLowerCase();
  return (
    normalized.startsWith("listing.") ||
    normalized === "approved" ||
    normalized === "rejected" ||
    normalized === "expired"
  );
}
