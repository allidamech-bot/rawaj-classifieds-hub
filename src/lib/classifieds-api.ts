import {
  ownerSaveAdPlacement as ownerSaveAdPlacementBase,
  ownerDeleteAdPlacement as ownerDeleteAdPlacementBase,
} from "@/lib/api/ad-placements-cloudflare";
import { invalidateActiveAdPlacementCache } from "@/lib/api/public-ad-placements";

export * from "@/lib/api/shared";
export * from "@/lib/api/references";
export * from "@/lib/api/locations";
export * from "@/lib/api/listings";
export { fetchListingDetailGuarded as fetchListingDetail } from "@/lib/api/listing-detail-read-guarded";
export { fetchListingImages } from "@/lib/api/listing-images-read-guarded";
export { fetchOwnerListingDetail } from "@/lib/api/listing-owner-read-guarded";
export {
  createOwnerDraftCopyRequestId,
  createOwnerDraftListing,
  createOwnerDraftListingCopy,
} from "@/lib/api/listing-draft-create-guarded";
export { completeOwnerDraftCreationFlow } from "@/lib/api/listing-draft-creation-flow";
export {
  submitOwnerListingForReview,
  updateOwnerListing,
} from "@/lib/api/listing-owner-write-guarded";
export { uploadListingImage } from "@/lib/api/listing-image-upload-guarded";
export * from "@/lib/api/listing-taxonomy";
export * from "@/lib/api/listing-attributes";
export * from "@/lib/api/taxonomy-metadata";
export * from "@/lib/api/listing-lifecycle";
export * from "@/lib/api/listing-image-order";
export * from "@/lib/api/listing-reservation";
export * from "@/lib/api/listing-expiry-retention";
export * from "@/lib/api/draft-recovery";
export * from "@/lib/api/listing-conversation-context";
export * from "@/lib/api/notification-target-resolution";
export * from "@/lib/api/notification-preferences";
export * from "@/lib/api/push-notifications";
export * from "@/lib/api/listing-price-context";
export * from "@/lib/api/price-drops";
export * from "@/lib/api/listing-price-offers";
export { fetchPublicListingsCanonicalAware as fetchPublicListings } from "@/lib/api/location-aware-listings-v2";
export * from "@/lib/api/seller";
export { fetchPublicSellerProfileGuarded as fetchPublicSellerProfile } from "@/lib/api/seller-profile-read-guarded";
export * from "@/lib/api/retention-discovery";
export * from "@/lib/api/messaging-guarded";
export * from "@/lib/api/favorites-guarded";
export * from "@/lib/api/saved-searches-guarded";
export * from "@/lib/api/saved-search-alerts";
export * from "@/lib/api/reviews-guarded";
export * from "@/lib/api/review-reports";
export * from "@/lib/api/verification";
export * from "@/lib/api/promotions-guarded";
export * from "@/lib/api/reports-guarded";
export * from "@/lib/api/support-guarded";
export * from "@/lib/api/notifications";
export * from "@/lib/api/admin";
export * from "@/lib/api/admin-users";
export * from "@/lib/api/admin-operations";
export * from "@/lib/api/admin-listing-moderation-guarded";
export * from "@/lib/api/ad-placements-cloudflare";
export * from "@/lib/api/campaigns";
export * from "@/lib/api/safety-cases";
export * from "@/lib/api/safety-case-details";
export * from "@/lib/api/owner-system-controls";
export * from "@/lib/api/profile";
export * from "@/lib/api/account-security";

export async function ownerSaveAdPlacement(
  ...args: Parameters<typeof ownerSaveAdPlacementBase>
): ReturnType<typeof ownerSaveAdPlacementBase> {
  const result = await ownerSaveAdPlacementBase(...args);
  if (result.ok) invalidateActiveAdPlacementCache();
  return result;
}

export async function ownerDeleteAdPlacement(
  ...args: Parameters<typeof ownerDeleteAdPlacementBase>
): ReturnType<typeof ownerDeleteAdPlacementBase> {
  const result = await ownerDeleteAdPlacementBase(...args);
  if (result.ok) invalidateActiveAdPlacementCache();
  return result;
}
