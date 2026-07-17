import {
  getClient,
  mapError,
  rowArray,
  rowBoolean,
  rowNullableString,
  rowNumber,
  rowString,
} from "@/lib/api/shared";
import type { ClassifiedsResult } from "@/lib/classifieds-types";
import type { AdPlacementPage } from "@/lib/api/ad-placements";

export type CampaignStatus = "draft" | "active" | "paused" | "ended";

export interface CampaignSummary {
  id: string;
  name: string;
  status: CampaignStatus;
  startsAt: string | null;
  endsAt: string | null;
  targetPages: AdPlacementPage[];
  targetCategoryIds: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
  creativeCount: number;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface CampaignCreativeSummary {
  id: string;
  campaignId: string;
  name: string;
  imageUrl: string;
  destinationUrl: string;
  weight: number;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

let campaignReadGeneration = 0;
let creativeReadGeneration = 0;
const campaignMutationInFlight = new Set<string>();
const creativeMutationInFlight = new Set<string>();

function staleReadResult<T>(): ClassifiedsResult<T> {
  return {
    ok: false,
    error: { code: "stale_request", message: "" },
  };
}

function operationInProgressResult<T>(message: string): ClassifiedsResult<T> {
  return {
    ok: false,
    error: { code: "operation_in_progress", message },
  };
}

export async function ownerFetchCampaigns(
  canManageCampaigns: boolean,
): Promise<ClassifiedsResult<CampaignSummary[]>> {
  if (!canManageCampaigns) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "إدارة الحملات متاحة للمالك فقط." },
    };
  }

  const requestGeneration = ++campaignReadGeneration;
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const { data, error } = await clientResult.data.rpc("rawaj_owner_list_campaigns");
  if (requestGeneration !== campaignReadGeneration) return staleReadResult();
  if (error) return { ok: false, error: mapError(error) };
  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map(mapCampaign),
  };
}

export async function ownerFetchCampaignCreatives(
  canManageCampaigns: boolean,
  campaignId: string,
): Promise<ClassifiedsResult<CampaignCreativeSummary[]>> {
  if (!canManageCampaigns) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "إدارة الحملات متاحة للمالك فقط." },
    };
  }

  const requestGeneration = ++creativeReadGeneration;
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const { data, error } = await clientResult.data.rpc("rawaj_owner_list_campaign_creatives", {
    p_campaign_id: campaignId,
  });
  if (requestGeneration !== creativeReadGeneration) return staleReadResult();
  if (error) return { ok: false, error: mapError(error) };
  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map(mapCreative),
  };
}

export async function ownerSaveCampaign(
  canManageCampaigns: boolean,
  payload: {
    id?: string | null;
    name: string;
    status: CampaignStatus;
    startsAt?: string | null;
    endsAt?: string | null;
    targetPages: AdPlacementPage[];
    targetCategoryIds: string[];
    expectedVersion?: number | null;
  },
): Promise<ClassifiedsResult<{ id: string; version: number; updatedAt: string }>> {
  if (!canManageCampaigns) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "إدارة الحملات متاحة للمالك فقط." },
    };
  }

  const name = payload.name.trim();
  if (name.length < 2) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل اسماً واضحاً للحملة." },
    };
  }

  const operationKey = `campaign:${payload.id || "new"}`;
  if (campaignMutationInFlight.has(operationKey)) {
    return operationInProgressResult("حفظ الحملة قيد التنفيذ بالفعل.");
  }
  campaignMutationInFlight.add(operationKey);

  try {
    const clientResult = getClient();
    if (!clientResult.ok) return clientResult;
    const { data, error } = await clientResult.data.rpc("rawaj_owner_upsert_campaign", {
      p_id: payload.id || null,
      p_name: name,
      p_status: payload.status,
      p_starts_at: payload.startsAt || null,
      p_ends_at: payload.endsAt || null,
      p_target_pages: payload.targetPages,
      p_target_category_ids: payload.targetCategoryIds.map((value) => value.trim()).filter(Boolean),
      p_expected_version: payload.id ? (payload.expectedVersion ?? null) : null,
    });

    if (error) {
      if (error.message?.includes("stale_campaign")) {
        return {
          ok: false,
          error: { code: "unknown", message: "تغيّرت الحملة منذ تحميلها. أعد التحميل قبل الحفظ." },
        };
      }
      return { ok: false, error: mapError(error) };
    }
    return mapMutationResult(data);
  } finally {
    campaignMutationInFlight.delete(operationKey);
  }
}

export async function ownerSetCampaignStatus(
  canManageCampaigns: boolean,
  payload: { id: string; status: CampaignStatus; expectedVersion: number; reason: string },
): Promise<ClassifiedsResult<{ id: string; version: number; updatedAt: string }>> {
  if (!canManageCampaigns) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "إدارة الحملات متاحة للمالك فقط." },
    };
  }
  const reason = payload.reason.trim();
  if (reason.length < 3) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل سبباً واضحاً لتغيير الحالة." },
    };
  }

  const operationKey = `campaign:${payload.id}`;
  if (campaignMutationInFlight.has(operationKey)) {
    return operationInProgressResult("هناك عملية أخرى قيد التنفيذ على هذه الحملة.");
  }
  campaignMutationInFlight.add(operationKey);

  try {
    const clientResult = getClient();
    if (!clientResult.ok) return clientResult;
    const { data, error } = await clientResult.data.rpc("rawaj_owner_set_campaign_status", {
      p_id: payload.id,
      p_status: payload.status,
      p_expected_version: payload.expectedVersion,
      p_reason: reason,
    });
    if (error) {
      if (error.message?.includes("stale_campaign")) {
        return {
          ok: false,
          error: {
            code: "unknown",
            message: "تغيّرت الحملة منذ تحميلها. أعد التحميل قبل تغيير الحالة.",
          },
        };
      }
      return { ok: false, error: mapError(error) };
    }
    return mapMutationResult(data);
  } finally {
    campaignMutationInFlight.delete(operationKey);
  }
}

export async function ownerSaveCampaignCreative(
  canManageCampaigns: boolean,
  payload: {
    id?: string | null;
    campaignId: string;
    name: string;
    imageUrl: string;
    destinationUrl: string;
    weight: number;
    isActive: boolean;
    expectedVersion?: number | null;
  },
): Promise<ClassifiedsResult<{ id: string; version: number; updatedAt: string }>> {
  if (!canManageCampaigns) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "إدارة الحملات متاحة للمالك فقط." },
    };
  }

  if (
    !payload.campaignId ||
    payload.name.trim().length < 2 ||
    !payload.imageUrl.trim() ||
    !payload.destinationUrl.trim()
  ) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "أدخل الحملة واسم التصميم والصورة ورابط الوجهة.",
      },
    };
  }

  const operationKey = `creative:${payload.id || `${payload.campaignId}:new`}`;
  if (creativeMutationInFlight.has(operationKey)) {
    return operationInProgressResult("حفظ التصميم الإعلاني قيد التنفيذ بالفعل.");
  }
  creativeMutationInFlight.add(operationKey);

  try {
    const clientResult = getClient();
    if (!clientResult.ok) return clientResult;
    const { data, error } = await clientResult.data.rpc("rawaj_owner_upsert_campaign_creative", {
      p_id: payload.id || null,
      p_campaign_id: payload.campaignId,
      p_name: payload.name.trim(),
      p_image_url: payload.imageUrl.trim(),
      p_destination_url: payload.destinationUrl.trim(),
      p_weight: payload.weight,
      p_is_active: payload.isActive,
      p_expected_version: payload.id ? (payload.expectedVersion ?? null) : null,
    });
    if (error) {
      if (error.message?.includes("stale_campaign_creative")) {
        return {
          ok: false,
          error: { code: "unknown", message: "تغيّر التصميم منذ تحميله. أعد التحميل قبل الحفظ." },
        };
      }
      return { ok: false, error: mapError(error) };
    }
    return mapMutationResult(data);
  } finally {
    creativeMutationInFlight.delete(operationKey);
  }
}

function mapMutationResult(
  data: unknown,
): ClassifiedsResult<{ id: string; version: number; updatedAt: string }> {
  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (!row) {
    return {
      ok: false,
      error: { code: "unknown", message: "تم تنفيذ الطلب دون نتيجة قابلة للتحقق." },
    };
  }
  return {
    ok: true,
    data: {
      id: rowString(row, "id"),
      version: rowNumber(row, "version"),
      updatedAt: rowString(row, "updated_at"),
    },
  };
}

function mapCampaign(row: Record<string, unknown>): CampaignSummary {
  return {
    id: rowString(row, "id"),
    name: rowString(row, "name"),
    status: rowString(row, "status", "draft") as CampaignStatus,
    startsAt: rowNullableString(row, "starts_at"),
    endsAt: rowNullableString(row, "ends_at"),
    targetPages: rowArray(row, "target_pages") as AdPlacementPage[],
    targetCategoryIds: rowArray(row, "target_category_ids"),
    version: rowNumber(row, "version"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
    creativeCount: rowNumber(row, "creative_count"),
    impressions: rowNumber(row, "impressions"),
    clicks: rowNumber(row, "clicks"),
    ctr: rowNumber(row, "ctr"),
  };
}

function mapCreative(row: Record<string, unknown>): CampaignCreativeSummary {
  return {
    id: rowString(row, "id"),
    campaignId: rowString(row, "campaign_id"),
    name: rowString(row, "name"),
    imageUrl: rowString(row, "image_url"),
    destinationUrl: rowString(row, "destination_url"),
    weight: rowNumber(row, "weight"),
    isActive: rowBoolean(row, "is_active"),
    version: rowNumber(row, "version"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
    impressions: rowNumber(row, "impressions"),
    clicks: rowNumber(row, "clicks"),
    ctr: rowNumber(row, "ctr"),
  };
}
