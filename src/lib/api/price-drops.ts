import { publicListingExpiryFilter } from "@/lib/api/listing-expiry";
import {
  fetchOwnerListingDetail,
  hydrateListingsWithPrimaryImages,
  mapListing,
} from "@/lib/api/listings";
import { readReferences } from "@/lib/api/references";
import { getClient, mapError, rowNumber, rowString } from "@/lib/api/shared";
import type { ClassifiedListing, ClassifiedsResult } from "@/lib/classifieds-types";

export interface ListingPriceDropOffer {
  listing: ClassifiedListing;
  oldPrice: number;
  newPrice: number;
  discountPercent: number;
  droppedAt: string;
}

interface PriceDropMetadata {
  listingId: string;
  oldPrice: number;
  newPrice: number;
  discountPercent: number;
  droppedAt: string;
}

function mapPriceDropMetadata(row: Record<string, unknown>): PriceDropMetadata {
  return {
    listingId: rowString(row, "listing_id"),
    oldPrice: rowNumber(row, "old_price"),
    newPrice: rowNumber(row, "new_price"),
    discountPercent: rowNumber(row, "discount_percent"),
    droppedAt: rowString(row, "dropped_at"),
  };
}

export async function reduceOwnerListingPrice(
  userId: string | null,
  listingId: string,
  newPrice: number,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتخفيض سعر الإعلان." },
    };
  }

  const cleanListingId = listingId.trim();
  if (!cleanListingId || !Number.isFinite(newPrice) || newPrice <= 0) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل سعرا جديدا صالحا." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data.rpc("rawaj_owner_reduce_listing_price", {
    p_listing_id: cleanListingId,
    p_new_price: newPrice,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("listing_price_drop_requires_public_listing")) {
      return {
        ok: false,
        error: {
          code: "status_mismatch",
          message: "يمكن تخفيض سعر إعلان معتمد ومتوافر فقط.",
        },
      };
    }
    if (message.includes("listing_price_drop_requires_numeric_price")) {
      return {
        ok: false,
        error: {
          code: "status_mismatch",
          message: "التخفيض متاح للإعلانات ذات السعر الرقمي الثابت أو القابل للتفاوض فقط.",
        },
      };
    }
    if (
      message.includes("listing_price_drop_invalid_price") ||
      message.includes("listing_price_drop_too_small")
    ) {
      return {
        ok: false,
        error: {
          code: "validation_error",
          message: "يجب أن يكون السعر الجديد أقل من الحالي بتخفيض حقيقي لا يقل عن 1٪.",
        },
      };
    }
    if (message.includes("listing_price_drop_not_found")) {
      return {
        ok: false,
        error: { code: "not_found", message: "الإعلان غير موجود أو لا تملكه." },
      };
    }
    if (message.includes("listing_price_drop_account_restricted")) {
      return {
        ok: false,
        error: { code: "permission_denied", message: "الحساب غير مسموح له بإدارة الإعلانات." },
      };
    }
    return { ok: false, error: mapError(error, "owner_listing_price_drop") };
  }

  return fetchOwnerListingDetail(userId, cleanListingId);
}

export async function fetchActivePriceDropOffers(
  limit = 30,
): Promise<ClassifiedsResult<ListingPriceDropOffer[]>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const safeLimit = Math.max(1, Math.min(Math.trunc(limit) || 30, 50));
  const { data: offerData, error: offerError } = await clientResult.data.rpc(
    "rawaj_get_active_price_drop_offers",
    { p_limit: safeLimit },
  );

  if (offerError) return { ok: false, error: mapError(offerError, "public_price_drop_offers") };

  const metadata = ((offerData ?? []) as Record<string, unknown>[])
    .map(mapPriceDropMetadata)
    .filter(
      (item) =>
        Boolean(item.listingId) &&
        item.oldPrice > item.newPrice &&
        item.newPrice > 0 &&
        item.discountPercent >= 1,
    );

  if (metadata.length === 0) return { ok: true, data: [] };

  const references = await readReferences(clientResult.data);
  if (!references.ok) return { ok: false, error: references.error };

  const listingIds = [...new Set(metadata.map((item) => item.listingId))];
  const { data: listingData, error: listingError } = await clientResult.data
    .from("listings")
    .select("*")
    .in("id", listingIds)
    .eq("status", "approved")
    .is("archived_at", null)
    .or(publicListingExpiryFilter());

  if (listingError) {
    return { ok: false, error: mapError(listingError, "public_price_drop_listings") };
  }

  const listings = ((listingData ?? []) as Record<string, unknown>[]).map((row) =>
    mapListing(row, references.categories, references.governorates),
  );
  const hydrated = await hydrateListingsWithPrimaryImages(clientResult.data, listings);
  const listingsById = new Map(hydrated.map((listing) => [listing.id, listing] as const));

  return {
    ok: true,
    data: metadata.flatMap((item) => {
      const listing = listingsById.get(item.listingId);
      if (!listing || listing.price !== item.newPrice) return [];
      return [{ listing, ...item }];
    }),
  };
}
