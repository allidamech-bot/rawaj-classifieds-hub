/* eslint-disable prettier/prettier */
import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { normalizeChatResourceId } from "@/lib/chat-integrity";
import { getClient, mapError } from "@/lib/api/shared";

export const CHAT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const CHAT_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export interface UploadedChatImage {
  path: string;
  mimeType: (typeof CHAT_IMAGE_MIME_TYPES)[number];
  sizeBytes: number;
}

export function validateChatImage(file: File): ClassifiedsResult<null> {
  if (
    !CHAT_IMAGE_MIME_TYPES.includes(file.type as UploadedChatImage["mimeType"])
  ) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "اختر صورة JPG أو PNG أو WebP.",
      },
    };
  }
  if (file.size < 1 || file.size > CHAT_IMAGE_MAX_BYTES) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "يجب ألا يتجاوز حجم الصورة 5 ميغابايت.",
      },
    };
  }
  return { ok: true, data: null };
}

export async function uploadChatImage(payload: {
  conversationId: string;
  requestId: string;
  file: File;
}): Promise<ClassifiedsResult<UploadedChatImage>> {
  const conversationId = normalizeChatResourceId(payload.conversationId);
  const requestId = normalizeChatResourceId(payload.requestId);
  const validation = validateChatImage(payload.file);
  if (!conversationId || !requestId || !validation.ok) {
    return validation.ok
      ? {
          ok: false,
          error: {
            code: "validation_error",
            message: "تعذر تحديد مرفق المحادثة.",
          },
        }
      : validation;
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const userResult = await clientResult.data.auth.getUser();
  const userId = userResult.data.user?.id;
  if (userResult.error || !userId) {
    return {
      ok: false,
      error: {
        code: "auth_required",
        message: "يجب تسجيل الدخول لإرسال صورة.",
      },
    };
  }

  const extension = extensionForMime(payload.file.type);
  const path = `${conversationId}/${userId}/${requestId}.${extension}`;
  const { error } = await clientResult.data.storage
    .from("conversation-images")
    .upload(path, payload.file, {
      upsert: false,
      contentType: payload.file.type,
      cacheControl: "3600",
    });
  if (error) return { ok: false, error: mapError(error, "chat_image_upload") };

  return {
    ok: true,
    data: {
      path,
      mimeType: payload.file.type as UploadedChatImage["mimeType"],
      sizeBytes: payload.file.size,
    },
  };
}

export async function removeChatImage(path: string): Promise<void> {
  if (!path) return;
  const clientResult = getClient();
  if (!clientResult.ok) return;
  await clientResult.data.storage.from("conversation-images").remove([path]);
}

export async function createChatImageSignedUrl(
  path: string,
): Promise<string | null> {
  if (!path) return null;
  const clientResult = getClient();
  if (!clientResult.ok) return null;
  const { data, error } = await clientResult.data.storage
    .from("conversation-images")
    .createSignedUrl(path, 15 * 60);
  return error ? null : data.signedUrl;
}

function extensionForMime(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}