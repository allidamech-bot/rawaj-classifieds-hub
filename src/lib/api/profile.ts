import type {
  ClassifiedsErrorCode,
  ClassifiedsResult,
  ProfileMediaKind,
  ProfileMediaUploadPayload,
  UpdateProfileBasicsPayload,
} from "@/lib/classifieds-types";
import { validateProfileImageFile } from "@/lib/api/storage";
import { cloudflareApiRequest, cloudflareApiUrl } from "@/lib/cloudflare-auth";

export async function updateMyProfile(
  payload: UpdateProfileBasicsPayload,
): Promise<ClassifiedsResult<null>> {
  const normalized = normalizeProfilePayload(payload);
  if (!normalized.ok) return normalized;
  const result = await cloudflareApiRequest<Record<string, unknown>>("/v1/profile", {
    method: "PATCH",
    body: normalized.data,
  });
  return result.ok ? { ok: true, data: null } : apiFailure(result);
}

export const updateOwnProfileBasics = updateMyProfile;

export async function uploadMyProfileMedia({
  kind,
  file,
}: ProfileMediaUploadPayload): Promise<ClassifiedsResult<string>> {
  const validation = validateProfileImageFile(file);
  if (!validation.ok) {
    return {
      ok: false,
      error: { code: "validation_error", message: validation.error ?? "ملف الصورة غير صالح." },
    };
  }

  const form = new FormData();
  form.set("kind", kind);
  form.set("file", file, file.name);
  const result = await cloudflareApiRequest<{
    assetId: string;
    kind: ProfileMediaKind;
    url: string;
  }>("/v1/profile/media", { method: "POST", body: form });
  return result.ok ? { ok: true, data: cloudflareApiUrl(result.data.url) } : apiFailure(result);
}

export const uploadProfileMedia = uploadMyProfileMedia;

export async function removeMyProfileMedia(
  kind: ProfileMediaKind,
): Promise<ClassifiedsResult<null>> {
  const result = await cloudflareApiRequest<{ success: boolean }>(
    `/v1/profile/media/${encodeURIComponent(kind)}`,
    { method: "DELETE" },
  );
  return result.ok ? { ok: true, data: null } : apiFailure(result);
}

export const removeProfileMedia = removeMyProfileMedia;

function apiFailure<T>(result: { ok: false; error: string; code: string }): ClassifiedsResult<T> {
  return {
    ok: false,
    error: { code: result.code as ClassifiedsErrorCode, message: result.error },
  };
}

function normalizeProfilePayload(
  payload: UpdateProfileBasicsPayload,
): ClassifiedsResult<Required<UpdateProfileBasicsPayload>> {
  const firstName = normalizeSingleLine(payload.firstName);
  const lastName = normalizeSingleLine(payload.lastName);
  const computedDisplayName = [firstName, lastName].filter(Boolean).join(" ");
  const displayName = normalizeSingleLine(payload.displayName) || computedDisplayName;
  const governorate = normalizeSingleLine(payload.governorate) || null;
  const cityArea = normalizeSingleLine(payload.cityArea) || null;
  const bio = normalizeMultiline(payload.bio) || null;
  const businessName = normalizeSingleLine(payload.businessName) || null;
  const phone = normalizeSingleLine(payload.phone) || null;
  const whatsapp = normalizeSingleLine(payload.whatsapp) || null;
  const preferredContactMethod = normalizeSingleLine(payload.preferredContactMethod) || null;

  if (firstName.length < 2 || firstName.length > 40 || lastName.length > 40) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل الاسم الأول بين 2 و40 حرفاً." },
    };
  }
  if (!displayName || displayName.length > 120 || (businessName?.length ?? 0) > 120) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اسم العرض أو المنشأة أطول من الحد المسموح." },
    };
  }
  if (bio && bio.length > 600) {
    return {
      ok: false,
      error: { code: "validation_error", message: "النبذة يجب ألا تتجاوز 600 حرف." },
    };
  }
  if ((governorate?.length ?? 0) > 120 || (cityArea?.length ?? 0) > 80) {
    return {
      ok: false,
      error: { code: "validation_error", message: "قيمة الموقع أطول من الحد المسموح." },
    };
  }
  if ((phone?.length ?? 0) > 40 || (whatsapp?.length ?? 0) > 40) {
    return {
      ok: false,
      error: { code: "validation_error", message: "بيانات التواصل أطول من الحد المسموح." },
    };
  }
  if (preferredContactMethod && !["phone", "whatsapp", "chat"].includes(preferredContactMethod)) {
    return {
      ok: false,
      error: { code: "validation_error", message: "طريقة التواصل المحددة غير مدعومة." },
    };
  }

  return {
    ok: true,
    data: {
      firstName,
      lastName,
      displayName,
      governorate,
      cityArea,
      bio,
      businessName,
      phone,
      whatsapp,
      preferredContactMethod,
    },
  };
}

function normalizeSingleLine(value: string | null | undefined): string {
  return replaceControlCharacters(value ?? "", false)
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMultiline(value: string | null | undefined): string {
  return replaceControlCharacters(value ?? "", true)
    .replace(/\r\n?/g, "\n")
    .trim();
}

function replaceControlCharacters(value: string, preserveLineBreaks: boolean): string {
  return Array.from(value, (character) => {
    if (preserveLineBreaks && (character === "\n" || character === "\t")) return character;
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127 ? " " : character;
  }).join("");
}
