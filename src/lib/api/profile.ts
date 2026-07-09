import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClassifiedsResult,
  ProfileMediaKind,
  ProfileMediaUploadPayload,
  UpdateProfileBasicsPayload,
} from "@/lib/classifieds-types";
import {
  getClient,
  mapError,
  mapStorageError,
  rowNullableString,
  rowString,
} from "@/lib/api/shared";

import {
  buildProfileMediaPath,
  profileMediaBucket,
  validateProfileImageFile,
} from "@/lib/api/storage";

export async function updateOwnProfileBasics(
  userId: string | null,
  payload: UpdateProfileBasicsPayload,
): Promise<ClassifiedsResult<null>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتحديث الحساب." },
    };
  }

  const firstName = payload.firstName.trim();
  const lastName = payload.lastName.trim();
  const computedDisplayName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const displayName =
    payload.displayName && payload.displayName.trim().length > 0
      ? payload.displayName.trim()
      : computedDisplayName || null;
  const governorate = payload.governorate?.trim() || null;
  const cityArea = payload.cityArea?.trim() || null;
  const bio = payload.bio?.trim() || null;
  const businessName = payload.businessName?.trim() || null;
  const phone = payload.phone?.trim() || null;
  const whatsapp = payload.whatsapp?.trim() || null;
  const preferredContactMethod = payload.preferredContactMethod?.trim() || null;

  if (firstName.length < 2 || firstName.length > 40 || lastName.length > 40) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل الاسم الأول بين 2 و40 حرفا." },
    };
  }

  if (bio && bio.length > 600) {
    return {
      ok: false,
      error: { code: "validation_error", message: "النبذة يجب ألا تتجاوز 600 حرف." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName || null,
      display_name: displayName,
      governorate,
      city_area: cityArea,
      bio,
      business_name: businessName,
      phone,
      whatsapp,
      preferred_contact_method: preferredContactMethod,
    })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error) };
  if (!data) return missingProfileWriteResult();
  return { ok: true, data: null };
}

export async function uploadProfileMedia({
  userId,
  kind,
  file,
  oldPath,
}: ProfileMediaUploadPayload): Promise<ClassifiedsResult<string>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتحديث صورة الحساب." },
    };
  }

  const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
  const maxProfileImageSizeBytes = 3 * 1024 * 1024;

  if (!allowedImageTypes.includes(file.type)) {
    return {
      ok: false,
      error: { code: "validation_error", message: "الصيغ المسموحة للصور: JPG أو PNG أو WebP." },
    };
  }

  if (file.size > maxProfileImageSizeBytes) {
    return {
      ok: false,
      error: { code: "validation_error", message: "حجم صورة الملف يجب ألا يتجاوز 3MB." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const extension = file.name.split(".").pop()?.toLowerCase();
  const safeExtension =
    extension && ["jpg", "jpeg", "png", "webp"].includes(extension) ? extension : "jpg";
  const storagePath = `${userId}/${kind}/${crypto.randomUUID()}.${safeExtension}`;

  const uploadResult = await clientResult.data.storage
    .from(profileMediaBucket)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadResult.error) return { ok: false, error: mapStorageError(uploadResult.error) };

  function publicProfileMediaUrl(client: SupabaseClient, path: string | null): string | null {
    if (!path) return null;
    const { data } = client.storage.from(profileMediaBucket).getPublicUrl(path);
    return data.publicUrl ?? null;
  }

  const publicUrl = publicProfileMediaUrl(clientResult.data, storagePath);
  const updatePayload =
    kind === "avatar"
      ? { avatar_path: storagePath, avatar_url: publicUrl }
      : { cover_path: storagePath, cover_url: publicUrl };

  const { data: updatedProfile, error } = await clientResult.data
    .from("profiles")
    .update(updatePayload)
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (error || !updatedProfile) {
    const cleanupResult = await clientResult.data.storage
      .from(profileMediaBucket)
      .remove([storagePath]);
    if (cleanupResult.error) {
      console.error("Failed to clean up unlinked profile media upload", {
        userId,
        kind,
        storagePath,
        error: cleanupResult.error,
      });
    }
    if (error) return { ok: false, error: mapError(error) };
    return missingProfileWriteResult();
  }

  if (oldPath && oldPath.startsWith(`${userId}/${kind}/`)) {
    const cleanupResult = await clientResult.data.storage.from(profileMediaBucket).remove([oldPath]);
    if (cleanupResult.error) {
      console.error("Failed to clean up replaced profile media", {
        userId,
        kind,
        oldPath,
        error: cleanupResult.error,
      });
    }
  }

  return { ok: true, data: publicUrl ?? "" };
}

export async function removeProfileMedia(
  userId: string | null,
  kind: ProfileMediaKind,
  path: string | null | undefined,
): Promise<ClassifiedsResult<null>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتحديث صورة الحساب." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const updatePayload =
    kind === "avatar"
      ? { avatar_path: null, avatar_url: null }
      : { cover_path: null, cover_url: null };

  const { data: updatedProfile, error } = await clientResult.data
    .from("profiles")
    .update(updatePayload)
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error) };
  if (!updatedProfile) return missingProfileWriteResult();

  if (path && path.startsWith(`${userId}/${kind}/`)) {
    const storageResult = await clientResult.data.storage.from(profileMediaBucket).remove([path]);
    if (storageResult.error) {
      console.error("Failed to clean up profile media after profile reference removal", {
        userId,
        kind,
        path,
        error: storageResult.error,
      });
    }
  }

  return { ok: true, data: null };
}

function missingProfileWriteResult(): ClassifiedsResult<never> {
  return {
    ok: false,
    error: {
      code: "permission_denied",
      message: "لم يتم تحديث الحساب. أعد تسجيل الدخول ثم حاول مرة أخرى.",
      operation: "profile_update",
    },
  };
}
