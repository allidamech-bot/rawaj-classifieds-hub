import { getClient, mapError, rowBoolean, rowNumber, rowString } from "@/lib/api/shared";
import type { ClassifiedsResult } from "@/lib/classifieds-types";

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

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const { data, error } = await clientResult.data.rpc("rawaj_owner_list_system_controls");
  if (error) return { ok: false, error: mapError(error) };

  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      key: rowString(row, "key") as OwnerSystemControlKey,
      enabled: rowBoolean(row, "enabled"),
      reason: rowString(row, "reason"),
      version: rowNumber(row, "version"),
      updatedBy: rowString(row, "updated_by"),
      updatedAt: rowString(row, "updated_at"),
    })),
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

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const { data, error } = await clientResult.data.rpc("rawaj_owner_set_system_control", {
    p_key: payload.key,
    p_enabled: payload.enabled,
    p_reason: reason,
    p_expected_version: payload.expectedVersion,
  });
  if (error) {
    if (error.message?.includes("stale_system_control")) {
      return {
        ok: false,
        error: {
          code: "unknown",
          message: "تغيّر مفتاح النظام منذ تحميله. أعد التحميل قبل المتابعة.",
        },
      };
    }
    return { ok: false, error: mapError(error) };
  }

  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (!row) {
    return {
      ok: false,
      error: { code: "unknown", message: "تم تنفيذ التغيير دون نتيجة قابلة للتحقق." },
    };
  }

  return {
    ok: true,
    data: {
      key: rowString(row, "key") as OwnerSystemControlKey,
      enabled: rowBoolean(row, "enabled"),
      version: rowNumber(row, "version"),
      updatedAt: rowString(row, "updated_at"),
    },
  };
}
