import { getClient, mapError } from "@/lib/api/shared";
import { supportsSypDenominationSchema } from "@/lib/api/syp-denomination-schema";
import { mapListing } from "@/lib/api/listings";
import type { ClassifiedListing, ClassifiedsResult } from "@/lib/classifieds-types";
import type { SypDenomination } from "@/lib/syp-redenomination";

export async function fetchUnclassifiedSypPriceQueue(): Promise<
  ClassifiedsResult<ClassifiedListing[]>
> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  if (!(await supportsSypDenominationSchema(clientResult.data))) {
    return { ok: true, data: [] };
  }

  const { data, error } = await clientResult.data.rpc("rawaj_list_unclassified_syp_prices");
  if (error) return { ok: false, error: mapError(error, "syp_denomination_queue") };

  return {
    ok: true,
    data: (Array.isArray(data) ? (data as Record<string, unknown>[]) : []).map((row) =>
      mapListing(row),
    ),
  };
}

export async function classifySypListingPrice(
  listingId: string,
  denomination: SypDenomination,
  expectedUpdatedAt: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  if (!(await supportsSypDenominationSchema(clientResult.data))) {
    return {
      ok: false,
      error: {
        code: "schema_missing",
        message: "تصنيف وحدة السعر غير متاح قبل تطبيق Migration الخاصة بالمرحلة A.",
        operation: "syp_denomination_classify",
      },
    };
  }

  const { data, error } = await clientResult.data.rpc("rawaj_classify_syp_listing_price", {
    p_listing_id: listingId,
    p_denomination: denomination,
    p_expected_updated_at: expectedUpdatedAt,
  });
  if (error) return { ok: false, error: mapError(error, "syp_denomination_classify") };

  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  if (!row) {
    return {
      ok: false,
      error: {
        code: "unknown",
        message: "تم التصنيف دون نتيجة إعلان قابلة للتحقق.",
        operation: "syp_denomination_classify",
      },
    };
  }
  return { ok: true, data: mapListing(row) };
}
