import type { ClassifiedsResult, PublicSellerProfile } from "@/lib/classifieds-types";
import { guardPublicSellerProfileResult } from "@/lib/api/seller-profile-load-guard";
import { fetchPublicSellerProfile as fetchPublicSellerProfileBase } from "@/lib/api/seller";

export async function fetchPublicSellerProfileGuarded(
  sellerId: string,
): Promise<ClassifiedsResult<PublicSellerProfile>> {
  return guardPublicSellerProfileResult(await fetchPublicSellerProfileBase(sellerId));
}
