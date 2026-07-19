import { getClient, mapError } from "@/lib/api/shared";
import type { ClassifiedsError, ClassifiedsResult } from "@/lib/classifieds-types";

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

export async function fetchTaxonomyMappingQueue(
  userId: string | null,
  options: {
    status?: TaxonomyMappingQueueStatus | null;
    limit?: number;
    offset?: number;
  } = {},
): Promise<ClassifiedsResult<ReviewQueuePage<TaxonomyMappingQueueItem>>> {
  if (!userId) return authenticationFailure();
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc(
    "rawaj_admin_fetch_taxonomy_mapping_queue_v1",
    {
      p_status: options.status ?? null,
      p_limit: clampInteger(options.limit, 1, 200, 50),
      p_offset: clampInteger(options.offset, 0, 1_000_000, 0),
    },
  );

  if (error) return rpcFailure(error, "taxonomy_mapping_queue_fetch");
  return { ok: true, data: parsePage(data, parseTaxonomyMappingQueueItem) };
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
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_admin_review_taxonomy_mapping_v1", {
    p_listing_id: input.listingId.trim(),
    p_decision: input.decision,
    p_version_id: cleanNullableText(input.versionId),
    p_taxonomy_node_id: cleanNullableText(input.taxonomyNodeId),
    p_note: cleanNullableText(input.note),
    p_expected_queue_updated_at: input.expectedQueueUpdatedAt.trim(),
  });

  if (error) return rpcFailure(error, "taxonomy_mapping_review");
  return { ok: true, data: record(data) };
}

export async function applyConfirmedTaxonomyMapping(
  userId: string | null,
  listingId: string,
  expectedReviewedAt: string,
): Promise<ClassifiedsResult<Record<string, unknown>>> {
  if (!userId) return authenticationFailure();
  if (!listingId.trim() || !expectedReviewedAt.trim()) return validationFailure();
  return callMutation(
    "rawaj_owner_apply_confirmed_taxonomy_mapping_v1",
    {
      p_listing_id: listingId.trim(),
      p_expected_reviewed_at: expectedReviewedAt.trim(),
    },
    "taxonomy_mapping_apply",
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
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc(
    "rawaj_admin_fetch_vehicle_reference_queue_v1",
    {
      p_status: options.status ?? null,
      p_entity_type: options.entityType ?? null,
      p_limit: clampInteger(options.limit, 1, 200, 50),
      p_offset: clampInteger(options.offset, 0, 1_000_000, 0),
    },
  );

  if (error) return rpcFailure(error, "vehicle_reference_queue_fetch");
  return { ok: true, data: parsePage(data, parseVehicleReferenceQueueItem) };
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
  return callMutation(
    "rawaj_admin_review_vehicle_reference_v1",
    {
      p_queue_id: input.queueId.trim(),
      p_decision: input.decision,
      p_match_id: cleanNullableText(input.matchId),
      p_note: cleanNullableText(input.note),
      p_expected_queue_updated_at: input.expectedQueueUpdatedAt.trim(),
    },
    "vehicle_reference_review",
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
  if (!input.queueId.trim() || !input.reference.id.trim() || !input.expectedQueueUpdatedAt.trim()) {
    return validationFailure();
  }
  return callMutation(
    "rawaj_owner_create_vehicle_reference_from_queue_v1",
    {
      p_queue_id: input.queueId.trim(),
      p_reference: input.reference,
      p_note: cleanNullableText(input.note),
      p_expected_queue_updated_at: input.expectedQueueUpdatedAt.trim(),
    },
    "vehicle_reference_create",
  );
}

export async function applyVehicleReferenceResolution(
  userId: string | null,
  queueId: string,
  expectedReviewedAt: string,
): Promise<ClassifiedsResult<Record<string, unknown>>> {
  if (!userId) return authenticationFailure();
  if (!queueId.trim() || !expectedReviewedAt.trim()) return validationFailure();
  return callMutation(
    "rawaj_owner_apply_vehicle_reference_resolution_v1",
    {
      p_queue_id: queueId.trim(),
      p_expected_reviewed_at: expectedReviewedAt.trim(),
    },
    "vehicle_reference_apply",
  );
}

async function callMutation(
  functionName: string,
  parameters: Record<string, unknown>,
  operation: string,
): Promise<ClassifiedsResult<Record<string, unknown>>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const { data, error } = await clientResult.data.rpc(functionName, parameters);
  if (error) return rpcFailure(error, operation);
  return { ok: true, data: record(data) };
}

function parseTaxonomyMappingQueueItem(value: unknown): TaxonomyMappingQueueItem | null {
  const item = record(value);
  const status = taxonomyStatus(item.status);
  const listingId = text(item.listingId);
  if (!status || !listingId) return null;
  return {
    listingId,
    listingTitle: text(item.listingTitle),
    listingStatus: text(item.listingStatus),
    listingCategoryId: text(item.listingCategoryId),
    listingSubcategoryId: nullableText(item.listingSubcategoryId),
    listingUpdatedAt: text(item.listingUpdatedAt),
    currentTaxonomyNodeId: nullableText(item.currentTaxonomyNodeId),
    suggestedVersionId: nullableText(item.suggestedVersionId),
    suggestedVersionNumber: nullableNumber(item.suggestedVersionNumber),
    suggestedVersionStatus: nullableText(item.suggestedVersionStatus),
    suggestedTaxonomyNodeId: nullableText(item.suggestedTaxonomyNodeId),
    suggestedNameAr: nullableText(item.suggestedNameAr),
    suggestedNameEn: nullableText(item.suggestedNameEn),
    confidence: nullableNumber(item.confidence),
    status,
    mappingSource: text(item.mappingSource),
    evidence: record(item.evidence),
    attemptCount: integer(item.attemptCount),
    reviewedBy: nullableText(item.reviewedBy),
    reviewedAt: nullableText(item.reviewedAt),
    reviewNote: nullableText(item.reviewNote),
    reviewedListingUpdatedAt: nullableText(item.reviewedListingUpdatedAt),
    appliedBy: nullableText(item.appliedBy),
    appliedAt: nullableText(item.appliedAt),
    createdAt: text(item.createdAt),
    updatedAt: text(item.updatedAt),
  };
}

function parseVehicleReferenceQueueItem(value: unknown): VehicleReferenceQueueItem | null {
  const item = record(value);
  const id = text(item.id);
  const entityType = vehicleEntityType(item.entityType);
  const status = vehicleStatus(item.status);
  if (!id || !entityType || !status) return null;
  return {
    id,
    entityType,
    parentMakeId: nullableText(item.parentMakeId),
    parentMakeNameAr: nullableText(item.parentMakeNameAr),
    parentMakeNameEn: nullableText(item.parentMakeNameEn),
    parentModelId: nullableText(item.parentModelId),
    parentModelNameAr: nullableText(item.parentModelNameAr),
    parentModelNameEn: nullableText(item.parentModelNameEn),
    rawValue: text(item.rawValue),
    normalizedValue: text(item.normalizedValue),
    suggestedMatchId: nullableText(item.suggestedMatchId),
    suggestedMatchNameAr: nullableText(item.suggestedMatchNameAr),
    suggestedMatchNameEn: nullableText(item.suggestedMatchNameEn),
    listingId: nullableText(item.listingId),
    listingTitle: nullableText(item.listingTitle),
    listingStatus: nullableText(item.listingStatus),
    listingUpdatedAt: nullableText(item.listingUpdatedAt),
    requestedBy: nullableText(item.requestedBy),
    status,
    occurrenceCount: integer(item.occurrenceCount),
    reviewNote: nullableText(item.reviewNote),
    reviewedBy: nullableText(item.reviewedBy),
    reviewedAt: nullableText(item.reviewedAt),
    reviewedListingUpdatedAt: nullableText(item.reviewedListingUpdatedAt),
    appliedBy: nullableText(item.appliedBy),
    appliedAt: nullableText(item.appliedAt),
    createdAt: text(item.createdAt),
    updatedAt: text(item.updatedAt),
  };
}

function parsePage<T>(value: unknown, parser: (item: unknown) => T | null): ReviewQueuePage<T> {
  const payload = record(value);
  return {
    total: integer(payload.total),
    limit: integer(payload.limit),
    offset: integer(payload.offset),
    items: array(payload.items).map(parser).filter(isPresent),
  };
}

function rpcFailure<T>(
  error: { code?: string; message?: string; details?: string },
  operation: string,
): ClassifiedsResult<T> {
  const combined = `${error.message ?? ""} ${error.details ?? ""}`;
  if (combined.includes("stale_")) {
    const mapped: ClassifiedsError = {
      code: "status_mismatch",
      message: "تغيّرت بيانات المراجعة. حدّث القائمة قبل إعادة المحاولة.",
      details: error.details ?? error.message,
      operation,
    };
    return { ok: false, error: mapped };
  }
  return { ok: false, error: mapError(error, operation) };
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

function cleanNullableText(value: string | null | undefined): string | null {
  const result = value?.trim() ?? "";
  return result || null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown): string | null {
  const result = text(value).trim();
  return result || null;
}

function integer(value: unknown): number {
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) ? Math.trunc(result) : 0;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) ? result : null;
}

function taxonomyStatus(value: unknown): TaxonomyMappingQueueStatus | null {
  const result = text(value);
  return [
    "pending",
    "auto_mapped",
    "needs_review",
    "confirmed",
    "unresolved",
    "rejected",
    "applied",
  ].includes(result)
    ? (result as TaxonomyMappingQueueStatus)
    : null;
}

function vehicleStatus(value: unknown): VehicleReferenceQueueStatus | null {
  const result = text(value);
  return ["pending", "matched", "created", "rejected", "applied"].includes(result)
    ? (result as VehicleReferenceQueueStatus)
    : null;
}

function vehicleEntityType(value: unknown): VehicleReferenceEntityType | null {
  const result = text(value);
  return ["make", "model", "generation", "trim"].includes(result)
    ? (result as VehicleReferenceEntityType)
    : null;
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}
