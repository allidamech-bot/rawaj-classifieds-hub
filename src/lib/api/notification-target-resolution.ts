import { fetchMyNotificationById } from "@/lib/api/notifications";
import { fetchListingDetail } from "@/lib/api/listings";
import { fetchMyConversations } from "@/lib/api/messaging";
import { fetchPublicSellerProfile } from "@/lib/api/seller";
import { fetchMySupportRequest } from "@/lib/api/support";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
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
    const owned = await currentAccountOwnsSavedSearch(reference.id);
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
  const result = await cloudflareApiRequest<{ listing: Record<string, unknown> }>(
    `/api/listings/${encodeURIComponent(listingId)}`,
  );
  if (result.ok) {
    return { ok: true, data: { kind: "owner_listing", listingId } };
  }
  if (result.code === "not_found" || result.code === "permission_denied") {
    return { ok: true, data: null };
  }
  return {
    ok: false,
    error: { code: result.code as never, message: result.error },
  };
}

async function currentAccountOwnsSavedSearch(
  resourceId: string,
): Promise<ClassifiedsResult<boolean>> {
  const result = await cloudflareApiRequest<Array<{ id: string }>>(
    "/v1/account/saved-searches",
  );
  if (!result.ok) {
    return {
      ok: false,
      error: { code: result.code as never, message: result.error },
    };
  }
  return { ok: true, data: result.data.some((item) => item.id === resourceId) };
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
