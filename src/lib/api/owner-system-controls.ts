import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";

export type OwnerSystemControlKey =
  | "freeze_new_listings"
  | "freeze_new_messages"
  | "freeze_promotions"
  | "freeze_verifications"
  | "maintenance_mode"
  | "emergency_read_only";

export interface OwnerSystemControlSummary {
  key: OwnerSystemControlKey;
  enabled: boolean;
  reason: string;
  version: number;
  updatedBy: string;
  updatedAt: string;
}

export async function ownerFetchSystemControls(
  canManageSystemSettings: boolean,
): Promise<ClassifiedsResult<OwnerSystemControlSummary[]>> {
  if (!canManageSystemSettings) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "إعدادات النظام الحساسة متاحة للمالك فقط." },
    };
  }

  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<OwnerSystemControlSummary[]>(
      "/v1/admin/system-controls",
    );
    return result.ok
      ? { ok: true, data: result.data }
      : {
          ok: false,
          error: {
            code: result.code as import("@/lib/classifieds-types").ClassifiedsErrorCode,
            message: result.error,
          },
        };
  }

  return {
    ok: false,
    error: {
      code: "setup_required",
      message: "إعدادات النظام متاحة فقط في وضع Cloudflare.",
    },
  };
}

export async function ownerSetSystemControl(
  canManageSystemSettings: boolean,
  payload: {
    key: OwnerSystemControlKey;
    enabled: boolean;
    reason: string;
    expectedVersion: number;
  },
): Promise<
  ClassifiedsResult<{
    key: OwnerSystemControlKey;
    enabled: boolean;
    version: number;
    updatedAt: string;
  }>
> {
  if (!canManageSystemSettings) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "إعدادات النظام الحساسة متاحة للمالك فقط." },
    };
  }

  const reason = payload.reason.trim();
  if (reason.length < 3) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل سبباً واضحاً قبل تغيير مفتاح النظام." },
    };
  }

  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<{
      key: OwnerSystemControlKey;
      enabled: boolean;
      version: number;
      updatedAt: string;
    }>("/v1/admin/system-controls", {
      method: "POST",
      body: {
        key: payload.key,
        enabled: payload.enabled,
        reason,
        expectedVersion: payload.expectedVersion,
      },
    });
    return result.ok
      ? { ok: true, data: result.data }
      : {
          ok: false,
          error: {
            code: result.code as import("@/lib/classifieds-types").ClassifiedsErrorCode,
            message: result.error,
          },
        };
  }

  return {
    ok: false,
    error: {
      code: "setup_required",
      message: "تغيير إعدادات النظام متاح فقط في وضع Cloudflare.",
    },
  };
}
