import { completeOwnerDraftCreationFlow } from "@/lib/api/listing-draft-creation-flow";
import {
  submitOwnerListingForReview as submitOwnerListingForReviewBase,
  updateOwnerListing as updateOwnerListingBase,
} from "@/lib/api/listing-write-rpc";
import {
  readOwnerListingVersion,
  rememberOwnerListingVersion,
} from "@/lib/api/listing-owner-version";
import type {
  ClassifiedListing,
  ClassifiedsResult,
  UpdateListingPayload,
} from "@/lib/classifieds-types";
import { queueListingSharePrompt, readGrowthAttribution } from "@/lib/listing-share-growth";
import { claimListingShareReferral } from "@/lib/referral-growth-client";

export async function updateOwnerListing(
  userId: string | null,
  listingId: string,
  payload: UpdateListingPayload,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  const expectedUpdatedAt = readOwnerListingVersion(userId, listingId);
  if (!expectedUpdatedAt) {
    return {
      ok: false,
      error: {
        code: "status_mismatch",
        message: "تعذر التحقق من أحدث نسخة للإعلان. أعد تحميل الصفحة قبل حفظ التعديلات.",
        operation: "owner_listing_update",
      },
    };
  }

  const result = await updateOwnerListingBase(userId, listingId, payload, expectedUpdatedAt);
  if (result.ok) rememberOwnerListingVersion(userId, result.data);
  return result;
}

export async function submitOwnerListingForReview(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  const result = await submitOwnerListingForReviewBase(userId, listingId);
  if (result.ok) {
    rememberOwnerListingVersion(userId, result.data);
    completeOwnerDraftCreationFlow(userId, result.data.id);
    queueListingSharePrompt(result.data.id);
    claimReferralAttribution(result.data.id);
  }
  return result;
}

function claimReferralAttribution(referredListingId: string): void {
  const sourceListingId = readGrowthAttribution()?.firstTouch.listingId?.trim() ?? "";
  if (!sourceListingId || sourceListingId === referredListingId) return;

  void claimListingShareReferral(sourceListingId, referredListingId).catch(() => undefined);
}
