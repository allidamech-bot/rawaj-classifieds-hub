import type { ClassifiedsErrorCode, ClassifiedsResult } from "@/lib/classifieds-types";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";
import {
  fetchOwnerListingAttributeCompleteness as fetchCompletenessLegacy,
  fetchOwnerListingAttributes as fetchAttributesLegacy,
  replaceOwnerListingAttributes as replaceAttributesLegacy,
} from "./listing-attributes";

export * from "./listing-attributes";

import type {
  ListingAttributeCompleteness,
  ListingAttributeWriteResult,
  OwnerListingAttributeValues,
} from "./listing-attributes";

function failure<T>(result: { ok: false; error: string; code: string }): ClassifiedsResult<T> {
  return {
    ok: false,
    error: { code: result.code as ClassifiedsErrorCode, message: result.error },
  };
}

export function fetchOwnerListingAttributes(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<OwnerListingAttributeValues>> {
  if (!isCloudflarePublicDataProvider()) return fetchAttributesLegacy(userId, listingId);
  if (!userId) {
    return Promise.resolve({
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لحفظ تفاصيل الإعلان." },
    });
  }
  return cloudflareApiRequest<OwnerListingAttributeValues>(
    `/v1/listings/${encodeURIComponent(listingId.trim())}/attributes`,
  ).then((result) => (result.ok ? { ok: true, data: result.data } : failure(result)));
}

export function fetchOwnerListingAttributeCompleteness(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<ListingAttributeCompleteness>> {
  if (!isCloudflarePublicDataProvider()) return fetchCompletenessLegacy(userId, listingId);
  if (!userId) {
    return Promise.resolve({
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لحفظ تفاصيل الإعلان." },
    });
  }
  return cloudflareApiRequest<ListingAttributeCompleteness>(
    `/v1/listings/${encodeURIComponent(listingId.trim())}/attributes/completeness`,
  ).then((result) => (result.ok ? { ok: true, data: result.data } : failure(result)));
}

export function replaceOwnerListingAttributes(
  userId: string | null,
  listingId: string,
  expectedUpdatedAt: string,
  attributes: Record<string, unknown>,
): Promise<ClassifiedsResult<ListingAttributeWriteResult>> {
  if (!isCloudflarePublicDataProvider()) {
    return replaceAttributesLegacy(userId, listingId, expectedUpdatedAt, attributes);
  }
  if (!userId) {
    return Promise.resolve({
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لحفظ تفاصيل الإعلان." },
    });
  }
  return cloudflareApiRequest<ListingAttributeWriteResult>(
    `/v1/listings/${encodeURIComponent(listingId.trim())}/attributes`,
    {
      method: "PUT",
      body: { expectedUpdatedAt, attributes },
    },
  ).then((result) => (result.ok ? { ok: true, data: result.data } : failure(result)));
}
