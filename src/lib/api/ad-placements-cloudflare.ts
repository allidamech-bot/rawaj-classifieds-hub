import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import { validateAdPlacementImageFile } from "@/lib/api/storage";
import type { ClassifiedsResult } from "@/lib/classifieds-types";

export type AdPlacementPage =
  "home" | "search_results" | "listing_detail" | "categories" | "offers";

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

export interface DeleteAdPlacementPayload {
  id: string;
  expectedVersion: number;
  reason: string;
}

export interface DeleteAdPlacementResult {
  id: string;
  imageUrl: string;
  storagePath: string | null;
}

function denied<T>(): ClassifiedsResult<T> {
  return {
    ok: false,
    error: { code: "permission_denied", message: "إدارة المساحات الإعلانية متاحة للمالك فقط." },
  };
}

function fromApi<T>(
  result: Awaited<ReturnType<typeof cloudflareApiRequest<T>>>,
): ClassifiedsResult<T> {
  return result.ok
    ? { ok: true, data: result.data }
    : { ok: false, error: { code: result.code as never, message: result.error } };
}

export async function ownerFetchAdPlacements(
  canManageAdPlacements: boolean,
): Promise<ClassifiedsResult<AdPlacementSummary[]>> {
  if (!canManageAdPlacements) return denied();
  return fromApi(await cloudflareApiRequest<AdPlacementSummary[]>("/v1/admin/ad-placements"));
}

export async function ownerUploadAdPlacementImage(
  canManageAdPlacements: boolean,
  _userId: string | null,
  file: File,
): Promise<ClassifiedsResult<string>> {
  if (!canManageAdPlacements) return denied();
  const validation = validateAdPlacementImageFile(file);
  if (!validation.ok) {
    return {
      ok: false,
      error: { code: "validation_error", message: validation.error ?? "ملف الصورة غير صالح." },
    };
  }

  let prepared: File;
  try {
    prepared = await cropAdPlacementImage(file);
  } catch {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تجهيز الصورة تلقائياً. جرّب صورة أخرى." },
    };
  }

  const form = new FormData();
  form.append("file", prepared, prepared.name);
  const result = await cloudflareApiRequest<{ id: string; imageUrl: string }>(
    "/v1/admin/ad-placements/media",
    { method: "POST", body: form },
  );
  return result.ok
    ? { ok: true, data: result.data.imageUrl }
    : { ok: false, error: { code: result.code as never, message: result.error } };
}

export async function ownerSaveAdPlacement(
  canManageAdPlacements: boolean,
  payload: SaveAdPlacementPayload,
): Promise<ClassifiedsResult<{ id: string; version: number; updatedAt: string }>> {
  if (!canManageAdPlacements) return denied();
  const path = payload.id
    ? `/v1/admin/ad-placements/${encodeURIComponent(payload.id)}`
    : "/v1/admin/ad-placements";
  return fromApi(
    await cloudflareApiRequest<{ id: string; version: number; updatedAt: string }>(path, {
      method: payload.id ? "PATCH" : "POST",
      body: payload as unknown as Record<string, unknown>,
    }),
  );
}

export async function ownerSetAdPlacementStatus(
  canManageAdPlacements: boolean,
  payload: { id: string; status: AdPlacementStatus; expectedVersion: number; reason: string },
): Promise<ClassifiedsResult<{ id: string; version: number; updatedAt: string }>> {
  if (!canManageAdPlacements) return denied();
  return fromApi(
    await cloudflareApiRequest<{ id: string; version: number; updatedAt: string }>(
      `/v1/admin/ad-placements/${encodeURIComponent(payload.id)}/status`,
      { method: "PATCH", body: payload },
    ),
  );
}

export async function ownerDeleteAdPlacement(
  canManageAdPlacements: boolean,
  payload: DeleteAdPlacementPayload,
): Promise<ClassifiedsResult<DeleteAdPlacementResult>> {
  if (!canManageAdPlacements) return denied();
  return fromApi(
    await cloudflareApiRequest<DeleteAdPlacementResult>(
      `/v1/admin/ad-placements/${encodeURIComponent(payload.id)}`,
      { method: "DELETE", body: payload as unknown as Record<string, unknown> },
    ),
  );
}

export async function removeOrphanedAdPlacementImage(): Promise<void> {
  // R2 cleanup is handled atomically by the Worker when a placement is deleted.
}

async function cropAdPlacementImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const targetWidth = 1400;
    const targetHeight = 300;
    const targetRatio = targetWidth / targetHeight;
    const sourceRatio = bitmap.width / bitmap.height;

    let sourceWidth = bitmap.width;
    let sourceHeight = bitmap.height;
    let sourceX = 0;
    let sourceY = 0;

    if (sourceRatio > targetRatio) {
      sourceWidth = bitmap.height * targetRatio;
      sourceX = (bitmap.width - sourceWidth) / 2;
    } else {
      sourceHeight = bitmap.width / targetRatio;
      sourceY = (bitmap.height - sourceHeight) / 2;
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas_unavailable");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      bitmap,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      targetWidth,
      targetHeight,
    );

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error("encode_failed"))),
        "image/webp",
        0.9,
      );
    });
    const baseName = file.name.replace(/\.[^.]+$/, "").slice(0, 100) || "ad-placement";
    return new File([blob], `${baseName}-1400x300.webp`, { type: "image/webp" });
  } finally {
    bitmap.close();
  }
}
