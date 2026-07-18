import type { ClassifiedsResult, ConversationMessage } from "@/lib/classifieds-types";
import { normalizeChatResourceId } from "@/lib/chat-integrity";
import {
  sendConversationMessage as sendConversationMessageBase,
  uploadChatAudio as uploadChatAudioBase,
  validateChatAudio as validateChatAudioBase,
  type UploadedChatAudio,
} from "@/lib/api/messaging";
import { getClient } from "@/lib/api/shared";

const CHAT_AUDIO_BUCKET = "conversation-audio";

const CHAT_AUDIO_MIME_ALIASES: Record<string, UploadedChatAudio["mimeType"]> = {
  "audio/webm": "audio/webm",
  "video/webm": "audio/webm",
  "audio/mp4": "audio/mp4",
  "audio/m4a": "audio/mp4",
  "audio/x-m4a": "audio/mp4",
  "audio/mpeg": "audio/mpeg",
  "audio/mp3": "audio/mpeg",
  "audio/ogg": "audio/ogg",
};

export function normalizeChatAudioMimeType(value: string): UploadedChatAudio["mimeType"] | null {
  const baseType = value.trim().toLowerCase().split(";", 1)[0] ?? "";
  return CHAT_AUDIO_MIME_ALIASES[baseType] ?? null;
}

export function validateChatAudio(file: File, durationMs: number): ClassifiedsResult<null> {
  const normalized = normalizeChatAudioFile(file);
  if (!normalized) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "صيغة التسجيل الناتجة من هذا الجهاز غير مدعومة. أعد التسجيل أو حدّث التطبيق.",
        details: file.type || "missing_audio_mime_type",
        operation: "chat_audio_validation",
      },
    };
  }

  return validateChatAudioBase(normalized, durationMs);
}

export async function uploadChatAudio(payload: {
  conversationId: string;
  requestId: string;
  file: File;
  durationMs: number;
}): Promise<ClassifiedsResult<UploadedChatAudio>> {
  const normalizedFile = normalizeChatAudioFile(payload.file);
  if (!normalizedFile) return validateChatAudio(payload.file, payload.durationMs);

  const firstAttempt = await uploadChatAudioBase({ ...payload, file: normalizedFile });
  if (firstAttempt.ok) return firstAttempt;
  if (!isDuplicateStorageObject(firstAttempt.error)) return mapAudioUploadFailure(firstAttempt);

  const pathResult = await resolveAudioStoragePath({
    conversationId: payload.conversationId,
    requestId: payload.requestId,
    mimeType: normalizedFile.type as UploadedChatAudio["mimeType"],
  });
  if (!pathResult.ok) return pathResult;

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const removeResult = await clientResult.data.storage
    .from(CHAT_AUDIO_BUCKET)
    .remove([pathResult.data]);
  if (removeResult.error) {
    return {
      ok: false,
      error: {
        code: "setup_required",
        message: "تعذر تنظيف محاولة الصوت السابقة. أغلق المحادثة وافتحها ثم أعد الإرسال.",
        details: removeResult.error.message,
        operation: "chat_audio_retry_cleanup",
      },
    };
  }

  const retry = await uploadChatAudioBase({ ...payload, file: normalizedFile });
  return retry.ok ? retry : mapAudioUploadFailure(retry);
}

export async function sendConversationMessage(
  payload: Parameters<typeof sendConversationMessageBase>[0],
): Promise<ClassifiedsResult<ConversationMessage>> {
  const result = await sendConversationMessageBase(payload);
  if (result.ok || payload.attachment?.kind !== "audio") return result;

  const diagnostic = `${result.error.message} ${result.error.details ?? ""}`.toLowerCase();
  if (
    result.error.code === "permission_denied" ||
    result.error.code === "schema_missing" ||
    result.error.code === "setup_required" ||
    diagnostic.includes("rawaj_send_conversation_message_v4") ||
    diagnostic.includes("chat attachment upload could not be verified") ||
    diagnostic.includes("permission denied")
  ) {
    return {
      ok: false,
      error: {
        code: "setup_required",
        message: "تعذر تثبيت التسجيل الصوتي في المحادثة بسبب إعدادات الخدمة. لم تُرسل الرسالة.",
        details: result.error.details ?? result.error.message,
        operation: "chat_audio_message_send",
      },
    };
  }

  return result;
}

function normalizeChatAudioFile(file: File): File | null {
  const mimeType = normalizeChatAudioMimeType(file.type);
  if (!mimeType) return null;

  const extension = extensionForMimeType(mimeType);
  const baseName = file.name.replace(/\.[^.]+$/, "") || `voice-${Date.now()}`;
  const normalizedName = `${baseName}.${extension}`;
  if (file.type === mimeType && file.name.toLowerCase().endsWith(`.${extension}`)) return file;

  return new File([file], normalizedName, {
    type: mimeType,
    lastModified: file.lastModified || Date.now(),
  });
}

async function resolveAudioStoragePath(payload: {
  conversationId: string;
  requestId: string;
  mimeType: UploadedChatAudio["mimeType"];
}): Promise<ClassifiedsResult<string>> {
  const conversationId = normalizeChatResourceId(payload.conversationId);
  const requestId = normalizeChatResourceId(payload.requestId);
  if (!conversationId || !requestId) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "تعذر تحديد محاولة إرسال التسجيل الصوتي.",
        operation: "chat_audio_retry_path",
      },
    };
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
        message: "يجب تسجيل الدخول لإرسال تسجيل صوتي.",
        details: userResult.error?.message,
        operation: "chat_audio_retry_path",
      },
    };
  }

  return {
    ok: true,
    data: `${conversationId}/${userId}/${requestId}.${extensionForMimeType(payload.mimeType)}`,
  };
}

function extensionForMimeType(mimeType: UploadedChatAudio["mimeType"]): string {
  if (mimeType === "audio/mp4") return "m4a";
  if (mimeType === "audio/mpeg") return "mp3";
  if (mimeType === "audio/ogg") return "ogg";
  return "webm";
}

function isDuplicateStorageObject(error: {
  message: string;
  details?: string;
}): boolean {
  const value = `${error.message} ${error.details ?? ""}`.toLowerCase();
  return (
    value.includes("already exists") ||
    value.includes("duplicate") ||
    value.includes("resource already exists")
  );
}

function mapAudioUploadFailure(
  result: Extract<ClassifiedsResult<UploadedChatAudio>, { ok: false }>,
): ClassifiedsResult<UploadedChatAudio> {
  const diagnostic = `${result.error.message} ${result.error.details ?? ""}`.toLowerCase();
  if (
    result.error.code === "permission_denied" ||
    result.error.code === "storage_unconfigured" ||
    diagnostic.includes("row-level security") ||
    diagnostic.includes("bucket not found") ||
    diagnostic.includes("mime type") ||
    diagnostic.includes("not allowed")
  ) {
    return {
      ok: false,
      error: {
        code: "setup_required",
        message: "تعذر رفع التسجيل الصوتي بسبب إعدادات التخزين. لم تُرسل الرسالة.",
        details: result.error.details ?? result.error.message,
        operation: "chat_audio_upload",
      },
    };
  }

  return result;
}
