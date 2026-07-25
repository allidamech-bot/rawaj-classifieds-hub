import { mapListing } from "@/lib/api/listings";
import { readReferences } from "@/lib/api/references";
import { getClient, mapError } from "@/lib/api/shared";
import type { ClassifiedListing, ClassifiedsErrorCode, ClassifiedsResult } from "@/lib/classifieds-types";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";

export interface RecoverableDraft {
  listing: ClassifiedListing;
  lastSavedAt: string;
}

export async function fetchLatestRecoverableOwnerDraft(
  userId: string | null,
): Promise<ClassifiedsResult<RecoverableDraft | null>> {
  if (!userId) {
    return {
      ok: false,
      error: {
        code: "auth_required",
        message: "يجب تسجيل الدخول لاسترجاع المسودة.",
      },
    };
  }

  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<ClassifiedListing[]>("/v1/account/listings");
    if (!result.ok) {
      return {
        ok: false,
        error: { code: result.code as ClassifiedsErrorCode, message: result.error },
      };
    }
    const draft = [...result.data]
      .filter((listing) => listing.status === "draft")
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    return draft
      ? { ok: true, data: { listing: draft, lastSavedAt: draft.updatedAt } }
      : { ok: true, data: null };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const references = await readReferences(clientResult.data);
  if (!references.ok) return { ok: false, error: references.error };

  const { data, error } = await clientResult.data
    .from("listings")
    .select("*")
    .eq("owner_id", userId)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error) };
  if (!data) return { ok: true, data: null };

  const listing = mapListing(
    data as Record<string, unknown>,
    references.categories,
    references.governorates,
  );

  return {
    ok: true,
    data: {
      listing,
      lastSavedAt: listing.updatedAt,
    },
  };
}

export async function discardRecoverableOwnerDraft(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<null>> {
  if (!userId) {
    return {
      ok: false,
      error: {
        code: "auth_required",
        message: "يجب تسجيل الدخول لحذف المسودة.",
      },
    };
  }

  const cleanListingId = listingId.trim();
  if (!cleanListingId) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "تعذر تحديد المسودة المطلوبة.",
      },
    };
  }

  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<{ success: boolean }>(
      `/v1/listings/${encodeURIComponent(cleanListingId)}`,
      { method: "DELETE", body: {} },
    );
    return result.ok
      ? { ok: true, data: null }
      : {
          ok: false,
          error: { code: result.code as ClassifiedsErrorCode, message: result.error },
        };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("listings")
    .delete()
    .eq("id", cleanListingId)
    .eq("owner_id", userId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error) };
  if (!data) {
    return {
      ok: false,
      error: {
        code: "not_found",
        message: "المسودة غير موجودة أو لم تعد قابلة للحذف.",
      },
    };
  }

  return { ok: true, data: null };
}
