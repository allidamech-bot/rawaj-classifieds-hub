import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import type { ClassifiedsErrorCode, ClassifiedsResult } from "@/lib/classifieds-types";

export type TaxonomyMappingQueueStatus =
  "pending" | "auto_mapped" | "needs_review" | "confirmed" | "unresolved" | "rejected" | "applied";
export type VehicleReferenceQueueStatus =
  "pending" | "matched" | "created" | "rejected" | "applied";
export type VehicleReferenceEntityType = "make" | "model" | "generation" | "trim";

export interface ReviewQueuePage<T> {
  total: number;
  limit: number;
  offset: number;
  items: T[];
}

export interface TaxonomyMappingQueueItem {
  listingId: string;
  listingTitle: string;
  listingStatus: string;
  listingCategoryId: string;
  listingSubcategoryId: string | null;
  listingUpdatedAt: string;
  currentTaxonomyNodeId: string | null;
  suggestedVersionId: string | null;
  suggestedVersionNumber: number | null;
  suggestedVersionStatus: string | null;
  suggestedTaxonomyNodeId: string | null;
  suggestedNameAr: string | null;
  suggestedNameEn: string | null;
  confidence: number | null;
  status: TaxonomyMappingQueueStatus;
  mappingSource: string;
  evidence: Record<string, unknown>;
  attemptCount: number;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  reviewedListingUpdatedAt: string | null;
  appliedBy: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleReferenceQueueItem {
  id: string;
  entityType: VehicleReferenceEntityType;
  parentMakeId: string | null;
  parentMakeNameAr: string | null;
  parentMakeNameEn: string | null;
  parentModelId: string | null;
  parentModelNameAr: string | null;
  parentModelNameEn: string | null;
  rawValue: string;
  normalizedValue: string;
  suggestedMatchId: string | null;
  suggestedMatchNameAr: string | null;
  suggestedMatchNameEn: string | null;
  listingId: string | null;
  listingTitle: string | null;
  listingStatus: string | null;
  listingUpdatedAt: string | null;
  requestedBy: string | null;
  status: VehicleReferenceQueueStatus;
  occurrenceCount: number;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewedListingUpdatedAt: string | null;
  appliedBy: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleReferenceDraft {
  id: string;
  slug?: string;
  nameAr: string;
  nameEn?: string;
  aliases?: string[];
  countryCode?: string | null;
  vehicleType?: string | null;
  generationId?: string | null;
  startYear?: number | null;
  endYear?: number | null;
}

function fromApi<T>(
  result: Awaited<ReturnType<typeof cloudflareApiRequest<T>>>,
): ClassifiedsResult<T> {
  return result.ok
    ? { ok: true, data: result.data }
    : { ok: false, error: { code: result.code as ClassifiedsErrorCode, message: result.error } };
}

export async function fetchTaxonomyMappingQueue(
  userId: string | null,
  options: { status?: TaxonomyMappingQueueStatus | null; limit?: number; offset?: number } = {},
): Promise<ClassifiedsResult<ReviewQueuePage<TaxonomyMappingQueueItem>>> {
  if (!userId) return authenticationFailure();
  const params = new URLSearchParams({
    limit: String(clampInteger(options.limit, 1, 200, 50)),
    offset: String(clampInteger(options.offset, 0, 1_000_000, 0)),
  });
  if (options.status) params.set("status", options.status);
  return fromApi(
    await cloudflareApiRequest<ReviewQueuePage<TaxonomyMappingQueueItem>>(
      `/v1/admin/taxonomy-mappings?${params.toString()}`,
    ),
  );
}

export async function reviewTaxonomyMapping(
  userId: string | null,
  input: {
    listingId: string;
    decision: "confirm" | "reject";
    versionId?: string | null;
    taxonomyNodeId?: string | null;
    note?: string | null;
    expectedQueueUpdatedAt: string;
  },
): Promise<ClassifiedsResult<Record<string, unknown>>> {
  if (!userId) return authenticationFailure();
  if (!input.listingId.trim() || !input.expectedQueueUpdatedAt.trim()) return validationFailure();
  return fromApi(
    await cloudflareApiRequest<Record<string, unknown>>(
      `/v1/admin/taxonomy-mappings/${encodeURIComponent(input.listingId.trim())}/review`,
      { method: "PATCH", body: input },
    ),
  );
}

export async function applyConfirmedTaxonomyMapping(
  userId: string | null,
  listingId: string,
  expectedReviewedAt: string,
): Promise<ClassifiedsResult<Record<string, unknown>>> {
  if (!userId) return authenticationFailure();
  if (!listingId.trim() || !expectedReviewedAt.trim()) return validationFailure();
  return fromApi(
    await cloudflareApiRequest<Record<string, unknown>>(
      `/v1/admin/taxonomy-mappings/${encodeURIComponent(listingId.trim())}/apply`,
      { method: "POST", body: { expectedReviewedAt: expectedReviewedAt.trim() } },
    ),
  );
}

export async function fetchVehicleReferenceQueue(
  userId: string | null,
  options: {
    status?: VehicleReferenceQueueStatus | null;
    entityType?: VehicleReferenceEntityType | null;
    limit?: number;
    offset?: number;
  } = {},
): Promise<ClassifiedsResult<ReviewQueuePage<VehicleReferenceQueueItem>>> {
  if (!userId) return authenticationFailure();
  const params = new URLSearchParams({
    limit: String(clampInteger(options.limit, 1, 200, 50)),
    offset: String(clampInteger(options.offset, 0, 1_000_000, 0)),
  });
  if (options.status) params.set("status", options.status);
  if (options.entityType) params.set("entityType", options.entityType);
  return fromApi(
    await cloudflareApiRequest<ReviewQueuePage<VehicleReferenceQueueItem>>(
      `/v1/admin/vehicle-references?${params.toString()}`,
    ),
  );
}

export async function reviewVehicleReference(
  userId: string | null,
  input: {
    queueId: string;
    decision: "match" | "reject";
    matchId?: string | null;
    note?: string | null;
    expectedQueueUpdatedAt: string;
  },
): Promise<ClassifiedsResult<Record<string, unknown>>> {
  if (!userId) return authenticationFailure();
  if (!input.queueId.trim() || !input.expectedQueueUpdatedAt.trim()) return validationFailure();
  return fromApi(
    await cloudflareApiRequest<Record<string, unknown>>(
      `/v1/admin/vehicle-references/${encodeURIComponent(input.queueId.trim())}/review`,
      { method: "PATCH", body: input },
    ),
  );
}

export async function createVehicleReferenceFromQueue(
  userId: string | null,
  input: {
    queueId: string;
    reference: VehicleReferenceDraft;
    note?: string | null;
    expectedQueueUpdatedAt: string;
  },
): Promise<ClassifiedsResult<Record<string, unknown>>> {
  if (!userId) return authenticationFailure();
  if (!input.queueId.trim() || !input.reference.id.trim() || !input.expectedQueueUpdatedAt.trim())
    return validationFailure();
  return fromApi(
    await cloudflareApiRequest<Record<string, unknown>>(
      `/v1/admin/vehicle-references/${encodeURIComponent(input.queueId.trim())}/create`,
      {
        method: "POST",
        body: {
          reference: input.reference as unknown as Record<string, unknown>,
          note: input.note ?? null,
          expectedQueueUpdatedAt: input.expectedQueueUpdatedAt,
        },
      },
    ),
  );
}

export async function applyVehicleReferenceResolution(
  userId: string | null,
  queueId: string,
  expectedReviewedAt: string,
): Promise<ClassifiedsResult<Record<string, unknown>>> {
  if (!userId) return authenticationFailure();
  if (!queueId.trim() || !expectedReviewedAt.trim()) return validationFailure();
  return fromApi(
    await cloudflareApiRequest<Record<string, unknown>>(
      `/v1/admin/vehicle-references/${encodeURIComponent(queueId.trim())}/apply`,
      { method: "POST", body: { expectedReviewedAt: expectedReviewedAt.trim() } },
    ),
  );
}

function authenticationFailure<T>(): ClassifiedsResult<T> {
  return {
    ok: false,
    error: { code: "auth_required", message: "يجب تسجيل الدخول لإدارة قوائم المراجعة." },
  };
}
function validationFailure<T>(): ClassifiedsResult<T> {
  return {
    ok: false,
    error: { code: "validation_error", message: "بيانات عملية المراجعة غير مكتملة." },
  };
}
function clampInteger(
  value: number | undefined,
  minimum: number,
  maximum: number,
  fallback: number,
) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.trunc(value as number)));
}
