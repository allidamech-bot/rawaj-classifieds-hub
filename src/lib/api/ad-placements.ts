import { normalizeAdPlacementMediaUrl } from "@/lib/ad-placement-media-url";
import {
  getClient,
  mapError,
  mapStorageError,
  rowBoolean,
  rowNullableString,
  rowNumber,
  rowString,
} from "@/lib/api/shared";
import {
  adPlacementMediaBucket,
  buildAdPlacementMediaPath,
  validateImageFile,
} from "@/lib/api/storage";
import type { ClassifiedsResult } from "@/lib/classifieds-types";

export type AdPlacementPage =
  | "home"
  | "search_results"
  | "listing_detail"
  | "categories"
  | "offers";

export type AdPlacementStatus = "draft" | "active" | "paused";

export interface AdPlacementSummary {
  id: string;
  name: string;
  placementPage: AdPlacementPage;
  imageUrl: string;
  destinationUrl: string;
  startsAt: string | null;
  endsAt: string | null;
  status: AdPlacementStatus;
  priority: number;
  targetMobile: boolean;
  targetDesktop: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaveAdPlacementPayload {
  id?: string | null;
  name: string;
  placementPage: AdPlacementPage;
  imageUrl: string;
  destinationUrl: string;
  startsAt?: string | null;
  endsAt?: string | null;
  status: AdPlacementStatus;
  priority: number;
  targetMobile: boolean;
  targetDesktop: boolean;
  expectedVersion?: number | null;
}

function isSafeHttpsUrl(value: string) {
  if (!value || value.length > 2048 || /\s/.test(value)) return false;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export async function ownerUploadAdPlacementImage(
  canManageAdPlacements: boolean,
  userId: string | null,
  file: File,
): Promise<ClassifiedsResult<string>> {
  if (!canManageAdPlacements) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "إدارة صور المساحات الإعلانية متاحة للمالك فقط.",
      },
    };
  }
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لرفع صورة الإعلان." },
    };
  }

  const validation = validateImageFile(file);
  if (!validation.ok) {
    return {
      ok: false,
      error: { code: "validation_error", message: validation.error ?? "ملف الصورة غير صالح." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const storagePath = buildAdPlacementMediaPath(userId, file.name);
  const uploadResult = await clientResult.data.storage
    .from(adPlacementMediaBucket)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
  if (uploadResult.error) return { ok: false, error: mapStorageError(uploadResult.error) };

  const { data } = clientResult.data.storage.from(adPlacementMediaBucket).getPublicUrl(storagePath);
  const publicUrl = normalizeAdPlacementMediaUrl(data.publicUrl ?? "");
  if (!publicUrl) {
    await clientResult.data.storage.from(adPlacementMediaBucket).remove([storagePath]);
    return {
      ok: false,
      error: { code: "unknown", message: "تم رفع الصورة لكن تعذر إنشاء رابط العرض." },
    };
  }

  return { ok: true, data: publicUrl };
}

export async function ownerFetchAdPlacements(
  canManageAdPlacements: boolean,
): Promise<ClassifiedsResult<AdPlacementSummary[]>> {
  if (!canManageAdPlacements) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "إدارة المساحات الإعلانية متاحة للمالك فقط." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_owner_list_ad_placements");
  if (error) return { ok: false, error: mapError(error) };

  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map(mapAdPlacement),
  };
}

export async function ownerSaveAdPlacement(
  canManageAdPlacements: boolean,
  payload: SaveAdPlacementPayload,
): Promise<ClassifiedsResult<{ id: string; version: number; updatedAt: string }>> {
  if (!canManageAdPlacements) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "إدارة المساحات الإعلانية متاحة للمالك فقط." },
    };
  }

  const name = payload.name.trim();
  const imageUrl = normalizeAdPlacementMediaUrl(payload.imageUrl);
  const destinationUrl = payload.destinationUrl.trim();
  if (name.length < 2 || !imageUrl || !destinationUrl) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل اسم المساحة وصورة الإعلان ورابط الوجهة." },
    };
  }

  if (!isSafeHttpsUrl(imageUrl) || !isSafeHttpsUrl(destinationUrl)) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "اختر صورة إعلان صالحة واستخدم رابط HTTPS صحيحاً للوجهة.",
      },
    };
  }

  if (!payload.targetMobile && !payload.targetDesktop) {
    return {
      ok: false,
      error: { code: "validation_error", message: "حدد استهداف الجوال أو سطح المكتب على الأقل." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_owner_upsert_ad_placement", {
    p_id: payload.id || null,
    p_name: name,
    p_placement_page: payload.placementPage,
    p_image_url: imageUrl,
    p_destination_url: destinationUrl,
    p_starts_at: payload.startsAt || null,
    p_ends_at: payload.endsAt || null,
    p_status: payload.status,
    p_priority: payload.priority,
    p_target_mobile: payload.targetMobile,
    p_target_desktop: payload.targetDesktop,
    p_expected_version: payload.id ? (payload.expectedVersion ?? null) : null,
  });

  if (error) {
    if (error.message?.includes("stale_ad_placement")) {
      return {
        ok: false,
        error: {
          code: "unknown",
          message: "تغيّرت المساحة الإعلانية منذ تحميلها. أعد التحميل قبل الحفظ.",
        },
      };
    }
    return { ok: false, error: mapError(error) };
  }

  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (!row) {
    return {
      ok: false,
      error: { code: "unknown", message: "تم تنفيذ الحفظ دون نتيجة قابلة للتحقق." },
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

export async function ownerSetAdPlacementStatus(
  canManageAdPlacements: boolean,
  payload: { id: string; status: AdPlacementStatus; expectedVersion: number; reason: string },
): Promise<ClassifiedsResult<{ id: string; version: number; updatedAt: string }>> {
  if (!canManageAdPlacements) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "إدارة المساحات الإعلانية متاحة للمالك فقط." },
    };
  }

  const reason = payload.reason.trim();
  if (!payload.id || reason.length < 3) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل سبباً واضحاً لتغيير الحالة." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_owner_set_ad_placement_status", {
    p_id: payload.id,
    p_status: payload.status,
    p_expected_version: payload.expectedVersion,
    p_reason: reason,
  });

  if (error) {
    if (error.message?.includes("stale_ad_placement")) {
      return {
        ok: false,
        error: {
          code: "unknown",
          message: "تغيّرت المساحة الإعلانية منذ تحميلها. أعد التحميل قبل تغيير الحالة.",
        },
      };
    }
    return { ok: false, error: mapError(error) };
  }

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

function mapAdPlacement(row: Record<string, unknown>): AdPlacementSummary {
  return {
    id: rowString(row, "id"),
    name: rowString(row, "name"),
    placementPage: rowString(row, "placement_page", "home") as AdPlacementPage,
    imageUrl: normalizeAdPlacementMediaUrl(rowString(row, "image_url")),
    destinationUrl: rowString(row, "destination_url"),
    startsAt: rowNullableString(row, "starts_at"),
    endsAt: rowNullableString(row, "ends_at"),
    status: rowString(row, "status", "draft") as AdPlacementStatus,
    priority: rowNumber(row, "priority"),
    targetMobile: rowBoolean(row, "target_mobile"),
    targetDesktop: rowBoolean(row, "target_desktop"),
    version: rowNumber(row, "version"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}
