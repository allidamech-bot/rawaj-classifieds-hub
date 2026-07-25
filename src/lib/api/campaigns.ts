import type { AdPlacementPage } from "@/lib/api/ad-placements";
import type { ClassifiedsErrorCode, ClassifiedsResult } from "@/lib/classifieds-types";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";

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

function denied<T>(): ClassifiedsResult<T> {
  return { ok: false, error: { code: "permission_denied", message: "إدارة الحملات متاحة للمالك فقط." } };
}
function staleRead<T>(operation: string): ClassifiedsResult<T> {
  return { ok: false, error: { code: "unknown", message: "", operation } };
}
function inProgress<T>(message: string, operation: string): ClassifiedsResult<T> {
  return { ok: false, error: { code: "unknown", message, operation } };
}
function fromApi<T>(result: Awaited<ReturnType<typeof cloudflareApiRequest<T>>>): ClassifiedsResult<T> {
  return result.ok
    ? { ok: true, data: result.data }
    : { ok: false, error: { code: result.code as ClassifiedsErrorCode, message: result.error } };
}

export async function ownerFetchCampaigns(
  canManageCampaigns: boolean,
): Promise<ClassifiedsResult<CampaignSummary[]>> {
  if (!canManageCampaigns) return denied();
  const generation = ++campaignReadGeneration;
  const result = await cloudflareApiRequest<CampaignSummary[]>("/v1/admin/campaigns");
  if (generation !== campaignReadGeneration) return staleRead("admin_campaign_list_stale_read");
  return fromApi(result);
}

export async function ownerFetchCampaignCreatives(
  canManageCampaigns: boolean,
  campaignId: string,
): Promise<ClassifiedsResult<CampaignCreativeSummary[]>> {
  if (!canManageCampaigns) return denied();
  const generation = ++creativeReadGeneration;
  const result = await cloudflareApiRequest<CampaignCreativeSummary[]>(
    `/v1/admin/campaigns/${encodeURIComponent(campaignId)}/creatives`,
  );
  if (generation !== creativeReadGeneration) return staleRead("admin_campaign_creatives_stale_read");
  return fromApi(result);
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
  if (!canManageCampaigns) return denied();
  if (payload.name.trim().length < 2) {
    return { ok: false, error: { code: "validation_error", message: "أدخل اسماً واضحاً للحملة." } };
  }
  const key = `campaign:${payload.id || "new"}`;
  if (campaignMutationInFlight.has(key)) return inProgress("حفظ الحملة قيد التنفيذ بالفعل.", "admin_campaign_save_in_progress");
  campaignMutationInFlight.add(key);
  try {
    return fromApi(
      await cloudflareApiRequest<{ id: string; version: number; updatedAt: string }>(
        payload.id ? `/v1/admin/campaigns/${encodeURIComponent(payload.id)}` : "/v1/admin/campaigns",
        {
          method: payload.id ? "PATCH" : "POST",
          body: {
            name: payload.name.trim(),
            status: payload.status,
            startsAt: payload.startsAt ?? null,
            endsAt: payload.endsAt ?? null,
            targetPages: payload.targetPages,
            targetCategoryIds: payload.targetCategoryIds.map((value) => value.trim()).filter(Boolean),
            expectedVersion: payload.id ? (payload.expectedVersion ?? null) : undefined,
          },
        },
      ),
    );
  } finally {
    campaignMutationInFlight.delete(key);
  }
}

export async function ownerSetCampaignStatus(
  canManageCampaigns: boolean,
  payload: { id: string; status: CampaignStatus; expectedVersion: number; reason: string },
): Promise<ClassifiedsResult<{ id: string; version: number; updatedAt: string }>> {
  if (!canManageCampaigns) return denied();
  if (payload.reason.trim().length < 3) {
    return { ok: false, error: { code: "validation_error", message: "أدخل سبباً واضحاً لتغيير الحالة." } };
  }
  const key = `campaign:${payload.id}`;
  if (campaignMutationInFlight.has(key)) return inProgress("هناك عملية أخرى قيد التنفيذ على هذه الحملة.", "admin_campaign_status_in_progress");
  campaignMutationInFlight.add(key);
  try {
    return fromApi(
      await cloudflareApiRequest<{ id: string; version: number; updatedAt: string }>(
        `/v1/admin/campaigns/${encodeURIComponent(payload.id)}/status`,
        { method: "PATCH", body: payload },
      ),
    );
  } finally {
    campaignMutationInFlight.delete(key);
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
  if (!canManageCampaigns) return denied();
  if (!payload.campaignId || payload.name.trim().length < 2 || !payload.imageUrl.trim() || !payload.destinationUrl.trim()) {
    return { ok: false, error: { code: "validation_error", message: "أدخل الحملة واسم التصميم والصورة ورابط الوجهة." } };
  }
  const key = `creative:${payload.id || `${payload.campaignId}:new`}`;
  if (creativeMutationInFlight.has(key)) return inProgress("حفظ التصميم الإعلاني قيد التنفيذ بالفعل.", "admin_campaign_creative_save_in_progress");
  creativeMutationInFlight.add(key);
  try {
    const path = payload.id
      ? `/v1/admin/campaigns/${encodeURIComponent(payload.campaignId)}/creatives/${encodeURIComponent(payload.id)}`
      : `/v1/admin/campaigns/${encodeURIComponent(payload.campaignId)}/creatives`;
    return fromApi(
      await cloudflareApiRequest<{ id: string; version: number; updatedAt: string }>(path, {
        method: payload.id ? "PATCH" : "POST",
        body: {
          name: payload.name.trim(),
          imageUrl: payload.imageUrl.trim(),
          destinationUrl: payload.destinationUrl.trim(),
          weight: payload.weight,
          isActive: payload.isActive,
          expectedVersion: payload.id ? (payload.expectedVersion ?? null) : undefined,
        },
      }),
    );
  } finally {
    creativeMutationInFlight.delete(key);
  }
}
