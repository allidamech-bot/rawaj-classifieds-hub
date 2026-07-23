import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClassifiedsResult,
  ClassifiedsErrorCode,
  ProfileMediaKind,
  ProfileMediaUploadPayload,
  UpdateProfileBasicsPayload,
} from "@/lib/classifieds-types";
import {
  accountSessionStillMatches,
  resolveAuthenticatedAccountId,
} from "@/lib/api/account-identity";
import { getClient, mapError, mapStorageError, rowNullableString } from "@/lib/api/shared";
import {
  buildProfileMediaPath,
  profileMediaBucket,
  validateProfileImageFile,
} from "@/lib/api/storage";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";

const profilePrivateMediaSelect = "avatar_path,cover_path";

export async function updateMyProfile(
  payload: UpdateProfileBasicsPayload,
): Promise<ClassifiedsResult<null>> {
  const normalized = normalizeProfilePayload(payload);
  if (!normalized.ok) return normalized;
  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<Record<string, unknown>>("/api/profile", {
      method: "PATCH",
      body: normalized.data,
    });
    return result.ok
      ? { ok: true, data: null }
      : {
          ok: false,
          error: { code: result.code as ClassifiedsErrorCode, message: result.error },
        };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const actor = await resolveAuthenticatedAccountId(clientResult.data, "my_profile_update_auth");
  if (!actor.ok) return actor;

  const rpcResult = await clientResult.data.rpc("rawaj_update_my_profile", {
    p_first_name: normalized.data.firstName,
    p_last_name: normalized.data.lastName || null,
    p_display_name: normalized.data.displayName,
    p_governorate: normalized.data.governorate,
    p_city_area: normalized.data.cityArea,
    p_bio: normalized.data.bio,
    p_business_name: normalized.data.businessName,
    p_phone: normalized.data.phone,
    p_whatsapp: normalized.data.whatsapp,
    p_preferred_contact_method: normalized.data.preferredContactMethod,
  });

  if (!rpcResult.error) {
    const session = await accountSessionStillMatches(
      clientResult.data,
      actor.data,
      "my_profile_update_stale_guard",
    );
    return session.ok ? { ok: true, data: null } : session;
  }

  if (!isMissingAccountIntegrityRpc(rpcResult.error)) {
    return { ok: false, error: mapError(rpcResult.error, "my_profile_update") };
  }

  // Compatibility for installations where the repository migration is still pending.
  // The actor remains auth-derived and RLS still scopes the update to that actor.
  const { data, error } = await clientResult.data
    .from("profiles")
    .update({
      first_name: normalized.data.firstName,
      last_name: normalized.data.lastName || null,
      display_name: normalized.data.displayName,
      governorate: normalized.data.governorate,
      city_area: normalized.data.cityArea,
      bio: normalized.data.bio,
      business_name: normalized.data.businessName,
      phone: normalized.data.phone,
      whatsapp: normalized.data.whatsapp,
      preferred_contact_method: normalized.data.preferredContactMethod,
    })
    .eq("id", actor.data)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error, "my_profile_update_legacy") };
  if (!data) return missingProfileWriteResult();
  return { ok: true, data: null };
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

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const client = clientResult.data;
  const actor = await resolveAuthenticatedAccountId(client, "my_profile_media_upload_auth");
  if (!actor.ok) return actor;

  const currentPath = await readCurrentMediaPath(client, actor.data, kind);
  if (!currentPath.ok) return currentPath;

  const storagePath = buildProfileMediaPath(actor.data, kind, file.name);
  const uploadResult = await client.storage.from(profileMediaBucket).upload(storagePath, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (uploadResult.error) return { ok: false, error: mapStorageError(uploadResult.error) };

  const session = await accountSessionStillMatches(
    client,
    actor.data,
    "my_profile_media_upload_stale_guard",
  );
  if (!session.ok) {
    await cleanupUnlinkedProfileMedia(client, storagePath);
    return session;
  }

  const publicUrl = publicProfileMediaUrl(client, storagePath);
  const updateResult = await setMyProfileMediaReference(
    client,
    actor.data,
    kind,
    storagePath,
    publicUrl,
  );
  if (!updateResult.ok) {
    await cleanupUnlinkedProfileMedia(client, storagePath);
    return updateResult;
  }

  if (currentPath.data && isOwnedProfileMediaPath(currentPath.data, actor.data, kind)) {
    await client.storage.from(profileMediaBucket).remove([currentPath.data]);
  }

  return { ok: true, data: publicUrl ?? "" };
}

export const uploadProfileMedia = uploadMyProfileMedia;

export async function removeMyProfileMedia(
  kind: ProfileMediaKind,
): Promise<ClassifiedsResult<null>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const client = clientResult.data;
  const actor = await resolveAuthenticatedAccountId(client, "my_profile_media_remove_auth");
  if (!actor.ok) return actor;

  const currentPath = await readCurrentMediaPath(client, actor.data, kind);
  if (!currentPath.ok) return currentPath;

  const rpcResult = await client.rpc("rawaj_clear_my_profile_media", { p_kind: kind });
  if (rpcResult.error && !isMissingAccountIntegrityRpc(rpcResult.error)) {
    return { ok: false, error: mapError(rpcResult.error, "my_profile_media_remove") };
  }

  if (rpcResult.error) {
    const updatePayload =
      kind === "avatar"
        ? { avatar_path: null, avatar_url: null }
        : { cover_path: null, cover_url: null };
    const { data, error } = await client
      .from("profiles")
      .update(updatePayload)
      .eq("id", actor.data)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: mapError(error, "my_profile_media_remove_legacy") };
    if (!data) return missingProfileWriteResult();
  }

  if (currentPath.data && isOwnedProfileMediaPath(currentPath.data, actor.data, kind)) {
    await client.storage.from(profileMediaBucket).remove([currentPath.data]);
  }
  return { ok: true, data: null };
}

export const removeProfileMedia = removeMyProfileMedia;

async function setMyProfileMediaReference(
  client: SupabaseClient,
  accountId: string,
  kind: ProfileMediaKind,
  storagePath: string,
  publicUrl: string | null,
): Promise<ClassifiedsResult<null>> {
  const rpcResult = await client.rpc("rawaj_set_my_profile_media", {
    p_kind: kind,
    p_storage_path: storagePath,
    p_public_url: publicUrl,
  });
  if (!rpcResult.error) return { ok: true, data: null };
  if (!isMissingAccountIntegrityRpc(rpcResult.error)) {
    return { ok: false, error: mapError(rpcResult.error, "my_profile_media_reference") };
  }

  const updatePayload =
    kind === "avatar"
      ? { avatar_path: storagePath, avatar_url: publicUrl }
      : { cover_path: storagePath, cover_url: publicUrl };
  const { data, error } = await client
    .from("profiles")
    .update(updatePayload)
    .eq("id", accountId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: mapError(error, "my_profile_media_reference_legacy") };
  if (!data) return missingProfileWriteResult();
  return { ok: true, data: null };
}

async function readCurrentMediaPath(
  client: SupabaseClient,
  accountId: string,
  kind: ProfileMediaKind,
): Promise<ClassifiedsResult<string | null>> {
  const { data, error } = await client
    .from("profiles")
    .select(profilePrivateMediaSelect)
    .eq("id", accountId)
    .maybeSingle();
  if (error) return { ok: false, error: mapError(error, "my_profile_media_read") };
  if (!data) return missingProfileWriteResult();
  const row = data as Record<string, unknown>;
  return {
    ok: true,
    data: rowNullableString(row, kind === "avatar" ? "avatar_path" : "cover_path"),
  };
}

function publicProfileMediaUrl(client: SupabaseClient, path: string): string | null {
  return client.storage.from(profileMediaBucket).getPublicUrl(path).data.publicUrl ?? null;
}

function isOwnedProfileMediaPath(path: string, accountId: string, kind: ProfileMediaKind): boolean {
  return path.startsWith(`${accountId}/${kind}/`);
}

async function cleanupUnlinkedProfileMedia(client: SupabaseClient, path: string) {
  await client.storage.from(profileMediaBucket).remove([path]);
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
    const codePoint = character.codePointAt(0) ?? 0;
    if (preserveLineBreaks && (codePoint === 10 || codePoint === 13)) return character;
    return codePoint <= 31 || codePoint === 127 ? (preserveLineBreaks ? "" : " ") : character;
  }).join("");
}

function isMissingAccountIntegrityRpc(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST202" || error.code === "42883" || (error.message ?? "").includes("rawaj_")
  );
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
