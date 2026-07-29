import type {
  ClassifiedsResult,
  PublicSellerProfile,
  PublicSellerSearchResult,
} from "@/lib/classifieds-types";
import {
  fetchCloudflarePublicSellerProfile,
  searchCloudflarePublicSellers,
} from "@/lib/api/seller-cloudflare";

export async function fetchPublicSellerProfile(
  sellerId: string,
): Promise<ClassifiedsResult<PublicSellerProfile>> {
  return fetchCloudflarePublicSellerProfile(sellerId);
}

export async function searchPublicSellers(
  query: string,
  limit = 8,
): Promise<ClassifiedsResult<PublicSellerSearchResult[]>> {
  return searchCloudflarePublicSellers(query, limit);
}
