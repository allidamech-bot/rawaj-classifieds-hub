import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClassifiedsResult,
  BlockConversationPayload,
  Conversation,
  ConversationMessage,
  ConversationStatus,
  CreateMessageReportPayload,
  MessageReport,
  MessageReportStatus,
} from "@/lib/classifieds-types";
import {
  CHAT_HISTORY_PAGE_SIZE,
  CHAT_MESSAGE_MAX_LENGTH,
  normalizeChatResourceId,
  sortAndDedupeConversations,
  sortAndDedupeMessages,
} from "@/lib/chat-integrity";
import { emitUnreadActivityChanged } from "@/lib/unread-activity-events";
import { accountSessionStillMatches } from "@/lib/api/account-identity";
import { mapModerationError } from "@/lib/api/moderation-errors";
import { isMessageReportReason, normalizeModerationText } from "@/lib/moderation-contract";
import {
  getClient,
  isMissingMessageReportRpc,
  mapError,
  rowBoolean,
  rowNullableString,
  rowNumber,
  rowRecord,
  rowString,
} from "@/lib/api/shared";
import { logRecorderDiagnostics } from "@/lib/chat-audio-diagnostics";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";

const pendingMessageSends = new Map<string, Promise<ClassifiedsResult<ConversationMessage>>>();

export const CHAT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const CHAT_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const CHAT_AUDIO_MAX_BYTES = 10 * 1024 * 1024;
export const CHAT_AUDIO_MAX_DURATION_MS = 120_000;
export const CHAT_AUDIO_MIME_TYPES = [
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
] as const;

export interface UploadedChatImage {
  path: string;
  mimeType: (typeof CHAT_IMAGE_MIME_TYPES)[number];
  sizeBytes: number;
  kind: "image";
  durationMs: null;
}

export interface UploadedChatAudio {
  path: string;
  mimeType: (typeof CHAT_AUDIO_MIME_TYPES)[number];
  sizeBytes: number;
  kind: "audio";
  durationMs: number;
}

export function validateChatImage(file: File): ClassifiedsResult<null> {
  if (!CHAT_IMAGE_MIME_TYPES.includes(file.type as UploadedChatImage["mimeType"])) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اختر صورة JPG أو PNG أو WebP." },
    };
  }
  if (file.size < 1 || file.size > CHAT_IMAGE_MAX_BYTES) {
    return {
      ok: false,
      error: { code: "validation_error", message: "يجب ألا يتجاوز حجم الصورة 5 ميغابايت." },
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
          error: { code: "validation_error", message: "تعذر تحديد مرفق المحادثة." },
        }
      : validation;
  }
  if (isCloudflarePublicDataProvider()) return attachmentMigrationPending();

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const userResult = await clientResult.data.auth.getUser();
  const userId = userResult.data.user?.id;
  if (userResult.error || !userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لإرسال صورة." },
    };
  }

  const extension = extensionForChatImageMime(payload.file.type);
  const path = [conversationId, userId, requestId].join("/") + "." + extension;
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
      kind: "image",
      durationMs: null,
    },
  };
}

export async function removeChatImage(path: string): Promise<void> {
  if (!path) return;
  if (isCloudflarePublicDataProvider()) return;
  const clientResult = getClient();
  if (!clientResult.ok) return;
  await clientResult.data.storage.from("conversation-images").remove([path]);
}

export async function createChatImageSignedUrl(path: string): Promise<string | null> {
  if (!path) return null;
  if (isCloudflarePublicDataProvider()) return null;
  const clientResult = getClient();
  if (!clientResult.ok) return null;
  const { data, error } = await clientResult.data.storage
    .from("conversation-images")
    .createSignedUrl(path, 15 * 60);
  return error ? null : data.signedUrl;
}

function extensionForChatImageMime(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

const CHAT_AUDIO_MIME_ALIASES: Record<string, (typeof CHAT_AUDIO_MIME_TYPES)[number]> = {
  "audio/webm": "audio/webm",
  "video/webm": "audio/webm",
  "audio/mp4": "audio/mp4",
  "video/mp4": "audio/mp4",
  "audio/m4a": "audio/mp4",
  "audio/x-m4a": "audio/mp4",
  "audio/mpeg": "audio/mpeg",
  "audio/mp3": "audio/mpeg",
  "audio/ogg": "audio/ogg",
};

function normalizeChatAudioMimeType(value: string): UploadedChatAudio["mimeType"] | null {
  const raw = value.split(";")[0]?.trim().toLowerCase() ?? "";
  const mapped = CHAT_AUDIO_MIME_ALIASES[raw];
  return mapped ?? null;
}

function normalizeChatAudioFileName(originalName: string, mimeType: string): string {
  const extension = extensionForChatAudioMime(mimeType);
  const base = originalName.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}_-]+/gu, "-") || "voice";
  return `${base}.${extension}`;
}

function extensionForChatAudioMime(mimeType: string): string {
  if (mimeType === "audio/mp4") return "m4a";
  if (mimeType === "audio/mpeg") return "mp3";
  if (mimeType === "audio/ogg") return "ogg";
  return "webm";
}

export function validateChatAudio(file: File, durationMs: number): ClassifiedsResult<null> {
  const mimeType = normalizeChatAudioMimeType(file.type);
  if (!mimeType)
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "صيغة التسجيل الصوتي غير مدعومة.",
        operation: "chat_audio_validation",
      },
    };
  if (file.size < 1 || file.size > CHAT_AUDIO_MAX_BYTES)
    return {
      ok: false,
      error: { code: "validation_error", message: "يجب ألا يتجاوز التسجيل 10 ميغابايت." },
    };
  if (durationMs < 1_000 || durationMs > CHAT_AUDIO_MAX_DURATION_MS)
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "يجب أن يكون التسجيل بين ثانية واحدة و120 ثانية.",
      },
    };
  return { ok: true, data: null };
}

export async function uploadChatAudio(payload: {
  conversationId: string;
  requestId: string;
  file: File;
  durationMs: number;
}): Promise<ClassifiedsResult<UploadedChatAudio>> {
  const conversationId = normalizeChatResourceId(payload.conversationId);
  const requestId = normalizeChatResourceId(payload.requestId);
  const mimeType = normalizeChatAudioMimeType(payload.file.type);
  const durationMs = Number.isFinite(payload.durationMs) ? payload.durationMs : 0;
  const validation = validateChatAudio(payload.file, durationMs);
  if (!mimeType) {
    logRecorderDiagnostics({
      stage: "IOS_VALIDATION",
      selectedMimeType: payload.file.type,
      recorderMimeType: "",
      chunkMimeType: null,
      chunkCount: 0,
      totalBytes: 0,
      recorderState: "n/a",
      fileMimeType: payload.file.type,
      fileSize: payload.file.size,
      durationMs,
      operation: "chat_audio_validation",
    });
    return {
      ok: false,
      error: {
        code: "validation_error",
        operation: "chat_audio_validation",
        message: "صيغة التسجيل الصوتي غير مدعومة على هذا الجهاز. جرب متصفحاً آخر أو أعد التسجيل.",
      },
    };
  }
  if (!conversationId || !requestId || !validation.ok) {
    logRecorderDiagnostics({
      stage: "IOS_VALIDATION",
      selectedMimeType: payload.file.type,
      recorderMimeType: "",
      chunkMimeType: null,
      chunkCount: 0,
      totalBytes: 0,
      recorderState: "n/a",
      fileMimeType: payload.file.type,
      fileSize: payload.file.size,
      durationMs,
      operation: "chat_audio_validation",
    });
    return validation.ok
      ? {
          ok: false,
          error: {
            code: "validation_error",
            operation: "chat_audio_validation",
            message: "تعذر تحديد التسجيل الصوتي.",
          },
        }
      : validation;
  }
  if (payload.file.size < 1) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        operation: "chat_audio_validation",
        message: "التسجيل الصوتي فارغ. أعد التسجيل ثم حاول مجدداً.",
      },
    };
  }
  if (isCloudflarePublicDataProvider()) return attachmentMigrationPending();
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const userResult = await clientResult.data.auth.getUser();
  const userId = userResult.data.user?.id;
  if (userResult.error || !userId)
    return {
      ok: false,
      error: {
        code: "auth_required",
        operation: "chat_audio_recorder",
        message: "يجب تسجيل الدخول لإرسال تسجيل صوتي.",
      },
    };
  const extension = extensionForChatAudioMime(mimeType);
  const path = [conversationId, userId, requestId].join("/") + "." + extension;
  let audioBytes: ArrayBuffer;
  try {
    audioBytes = await payload.file.arrayBuffer();
  } catch (error) {
    logRecorderDiagnostics({
      stage: "IOS_PREPARE",
      selectedMimeType: null,
      recorderMimeType: "",
      chunkMimeType: null,
      chunkCount: 0,
      totalBytes: 0,
      recorderState: "n/a",
      fileMimeType: mimeType,
      fileSize: payload.file.size,
      arrayBufferSize: 0,
      durationMs,
      operation: "chat_audio_prepare",
      errorName: error instanceof Error ? error.name : undefined,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      error: {
        code: "validation_error",
        operation: "chat_audio_prepare",
        message: "تعذر تجهيز التسجيل الصوتي للإرسال. أعد تسجيله ثم حاول مجدداً.",
      },
    };
  }
  if (audioBytes.byteLength < 1) {
    logRecorderDiagnostics({
      stage: "IOS_PREPARE",
      selectedMimeType: null,
      recorderMimeType: "",
      chunkMimeType: null,
      chunkCount: 0,
      totalBytes: 0,
      recorderState: "n/a",
      fileMimeType: mimeType,
      fileSize: payload.file.size,
      arrayBufferSize: audioBytes.byteLength,
      durationMs,
      operation: "chat_audio_prepare",
    });
    return {
      ok: false,
      error: {
        code: "validation_error",
        operation: "chat_audio_prepare",
        message: "التسجيل الصوتي فارغ. أعد التسجيل ثم حاول مجدداً.",
      },
    };
  }
  const { error } = await clientResult.data.storage
    .from("conversation-audio")
    .upload(path, audioBytes, { upsert: false, contentType: mimeType, cacheControl: "3600" });
  if (error) {
    const mapped = mapError(error, "chat_audio_upload");
    logRecorderDiagnostics({
      stage: "IOS_UPLOAD",
      selectedMimeType: null,
      recorderMimeType: "",
      chunkMimeType: null,
      chunkCount: 0,
      totalBytes: 0,
      recorderState: "n/a",
      fileMimeType: mimeType,
      fileSize: payload.file.size,
      arrayBufferSize: audioBytes.byteLength,
      durationMs,
      supabaseErrorCode: mapped.code,
      httpStatus: typeof error.status === "number" ? error.status : null,
      operation: "chat_audio_upload",
    });
    return {
      ok: false,
      error: {
        ...mapped,
        operation: "chat_audio_upload",
        message:
          mapped.code === "permission_denied"
            ? "تعذر رفع التسجيل بسبب صلاحيات التخزين. أعد تسجيل الدخول ثم حاول مجدداً."
            : "تعذر رفع التسجيل الصوتي الآن. حاول إعادة التسجيل والإرسال.",
      },
    };
  }
  return {
    ok: true,
    data: {
      path,
      mimeType: mimeType as UploadedChatAudio["mimeType"],
      sizeBytes: audioBytes.byteLength,
      kind: "audio",
      durationMs,
    },
  };
}

export async function removeChatAudio(path: string): Promise<void> {
  if (!path) return;
  if (isCloudflarePublicDataProvider()) return;
  const clientResult = getClient();
  if (!clientResult.ok) return;
  await clientResult.data.storage.from("conversation-audio").remove([path]);
}

export async function createChatAudioSignedUrl(path: string): Promise<string | null> {
  if (!path) return null;
  if (isCloudflarePublicDataProvider()) return null;
  const clientResult = getClient();
  if (!clientResult.ok) return null;
  const { data, error } = await clientResult.data.storage
    .from("conversation-audio")
    .createSignedUrl(path, 15 * 60);
  return error ? null : data.signedUrl;
}

export async function downloadChatAudioObjectUrl(path: string): Promise<string | null> {
  if (!path || typeof URL === "undefined") return null;
  if (isCloudflarePublicDataProvider()) return null;
  const clientResult = getClient();
  if (!clientResult.ok) return null;
  const { data, error } = await clientResult.data.storage.from("conversation-audio").download(path);
  if (error || !data) return null;
  return URL.createObjectURL(data);
}

export async function startListingConversation(
  listingId: string,
): Promise<ClassifiedsResult<string>> {
  const cleanListingId = normalizeChatResourceId(listingId);
  if (!cleanListingId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان لبدء المحادثة." },
    };
  }
  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<{ id: string }>("/v1/conversations", {
      method: "POST",
      body: { listingId: cleanListingId },
    });
    return result.ok
      ? { ok: true, data: result.data.id }
      : { ok: false, error: { code: "unknown", message: result.error } };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_start_listing_conversation", {
    p_listing_id: cleanListingId,
  });

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: typeof data === "string" ? data : String(data) };
}

export async function fetchMyConversations(): Promise<ClassifiedsResult<Conversation[]>> {
  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<{ items: Record<string, unknown>[] }>(
      "/v1/account/conversations?pageSize=50",
    );
    return result.ok
      ? {
          ok: true,
          data: sortAndDedupeConversations(result.data.items.map(mapConversation)),
        }
      : { ok: false, error: { code: "unknown", message: result.error } };
  }
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_fetch_my_conversations");
  if (error) return { ok: false, error: mapError(error) };
  return {
    ok: true,
    data: sortAndDedupeConversations(
      ((data ?? []) as Record<string, unknown>[]).map(mapConversation),
    ),
  };
}

export async function fetchConversationMessages(
  conversationId: string,
): Promise<ClassifiedsResult<ConversationMessage[]>> {
  const cleanConversationId = normalizeChatResourceId(conversationId);
  if (!cleanConversationId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد المحادثة." },
    };
  }
  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<{ items: Record<string, unknown>[] }>(
      `/v1/conversations/${encodeURIComponent(cleanConversationId)}/messages?pageSize=${CHAT_HISTORY_PAGE_SIZE}`,
    );
    return result.ok
      ? {
          ok: true,
          data: sortAndDedupeMessages(
            result.data.items.map(mapCloudflareMessage),
            cleanConversationId,
          ),
        }
      : { ok: false, error: { code: "unknown", message: result.error } };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const actorResult = await getAuthenticatedUserId(clientResult.data);
  if (!actorResult.ok) return actorResult;

  const { data, error } = await clientResult.data
    .from("conversation_messages")
    .select(
      "id,conversation_id,sender_user_id,body,attachment_path,attachment_mime_type,attachment_size_bytes,attachment_kind,attachment_duration_ms,created_at,edited_at,deleted_at",
    )
    .eq("conversation_id", cleanConversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CHAT_HISTORY_PAGE_SIZE);

  if (error) return { ok: false, error: mapError(error) };
  const rows = (data ?? []) as Record<string, unknown>[];
  const mapped = await Promise.all(
    rows.map(async (row) => {
      const message = mapMessage(row, actorResult.data);
      if (!message.attachmentPath) return message;
      return {
        ...message,
        attachmentUrl:
          message.attachmentKind === "audio"
            ? await createChatAudioSignedUrl(message.attachmentPath)
            : await createChatImageSignedUrl(message.attachmentPath),
      };
    }),
  );
  return {
    ok: true,
    data: sortAndDedupeMessages(mapped, cleanConversationId),
  };
}

const MESSAGE_REQUEST_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function sendConversationMessage(payload: {
  conversationId: string;
  body: string;
  requestId: string;
  attachment?: {
    path: string;
    mimeType: string;
    sizeBytes: number;
    kind: "image" | "audio";
    durationMs: number | null;
  } | null;
}): Promise<ClassifiedsResult<ConversationMessage>> {
  const cleanConversationId = normalizeChatResourceId(payload.conversationId);
  const cleanBody = payload.body.trim();
  const cleanRequestId = payload.requestId.trim();
  const attachment = payload.attachment ?? null;
  if (
    !cleanConversationId ||
    (cleanBody.length < 1 && !attachment) ||
    cleanBody.length > CHAT_MESSAGE_MAX_LENGTH
  ) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اكتب رسالة بين 1 و2000 حرف." },
    };
  }
  if (!MESSAGE_REQUEST_UUID_PATTERN.test(cleanRequestId)) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد محاولة إرسال الرسالة." },
    };
  }
  if (isCloudflarePublicDataProvider()) {
    if (attachment) return attachmentMigrationPending();
    const result = await cloudflareApiRequest<Record<string, unknown>>(
      `/v1/conversations/${encodeURIComponent(cleanConversationId)}/messages`,
      {
        method: "POST",
        body: { body: cleanBody, requestId: cleanRequestId },
      },
    );
    return result.ok
      ? { ok: true, data: mapCloudflareMessage({ ...result.data, is_mine: 1 }) }
      : { ok: false, error: { code: "unknown", message: result.error } };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const actorResult = await getAuthenticatedUserId(clientResult.data);
  if (!actorResult.ok) return actorResult;

  const sendKey = JSON.stringify([actorResult.data, cleanConversationId, cleanRequestId]);
  const existingSend = pendingMessageSends.get(sendKey);
  if (existingSend) return existingSend;

  const sendPromise = performConversationMessageSend(
    clientResult.data,
    actorResult.data,
    cleanConversationId,
    cleanBody,
    cleanRequestId,
    attachment,
  );
  pendingMessageSends.set(sendKey, sendPromise);

  try {
    return await sendPromise;
  } finally {
    if (pendingMessageSends.get(sendKey) === sendPromise) {
      pendingMessageSends.delete(sendKey);
    }
  }
}

async function performConversationMessageSend(
  client: SupabaseClient,
  actorUserId: string,
  conversationId: string,
  cleanBody: string,
  clientRequestId: string,
  attachment: {
    path: string;
    mimeType: string;
    sizeBytes: number;
    kind: "image" | "audio";
    durationMs: number | null;
  } | null,
): Promise<ClassifiedsResult<ConversationMessage>> {
  let response = await client.rpc("rawaj_send_conversation_message_v4", {
    p_conversation_id: conversationId,
    p_client_request_id: clientRequestId,
    p_body: cleanBody,
    p_attachment_path: attachment?.path ?? null,
    p_attachment_mime_type: attachment?.mimeType ?? null,
    p_attachment_size_bytes: attachment?.sizeBytes ?? null,
    p_attachment_kind: attachment?.kind ?? null,
    p_attachment_duration_ms: attachment?.durationMs ?? null,
  });
  if (response.error && isMissingMessageSendV4(response.error) && attachment?.kind !== "audio") {
    response = await client.rpc("rawaj_send_conversation_message_v3", {
      p_conversation_id: conversationId,
      p_client_request_id: clientRequestId,
      p_body: cleanBody,
      p_attachment_path: attachment?.path ?? null,
      p_attachment_mime_type: attachment?.mimeType ?? null,
      p_attachment_size_bytes: attachment?.sizeBytes ?? null,
    });
  }

  if (!response.error) {
    const row = ((response.data ?? []) as Record<string, unknown>[])[0];
    if (row) {
      const message = mapMessage(row, actorUserId);
      if (message.attachmentPath) {
        message.attachmentUrl =
          message.attachmentKind === "audio"
            ? await createChatAudioSignedUrl(message.attachmentPath)
            : await createChatImageSignedUrl(message.attachmentPath);
      }
      return { ok: true, data: message };
    }
    logRecorderDiagnostics({
      stage: "IOS_MESSAGE_SEND",
      selectedMimeType: null,
      recorderMimeType: "",
      chunkMimeType: null,
      chunkCount: 0,
      totalBytes: 0,
      recorderState: "n/a",
      fileMimeType: attachment?.mimeType ?? null,
      fileSize: attachment?.sizeBytes ?? null,
      durationMs: attachment?.durationMs ?? null,
      operation: "conversation_message_send",
    });
    return {
      ok: false,
      error: {
        code: "unknown",
        message: "تم إرسال طلب الرسالة دون نتيجة قابلة للتحقق.",
        operation: "conversation_message_send",
      },
    };
  }

  if (!isMissingMessageSendV3(response.error)) {
    if (isMessageRequestPayloadMismatch(response.error)) {
      logRecorderDiagnostics({
        stage: "IOS_MESSAGE_SEND",
        selectedMimeType: null,
        recorderMimeType: "",
        chunkMimeType: null,
        chunkCount: 0,
        totalBytes: 0,
        recorderState: "n/a",
        fileMimeType: attachment?.mimeType ?? null,
        fileSize: attachment?.sizeBytes ?? null,
        durationMs: attachment?.durationMs ?? null,
        supabaseErrorCode: response.error.code,
        operation: "conversation_message_send",
      });
      return {
        ok: false,
        error: {
          code: "validation_error",
          message: "تغير محتوى محاولة الإرسال. أعد كتابة الرسالة ثم أرسلها مجدداً.",
          operation: "conversation_message_send",
        },
      };
    }
    logRecorderDiagnostics({
      stage: "IOS_MESSAGE_SEND",
      selectedMimeType: null,
      recorderMimeType: "",
      chunkMimeType: null,
      chunkCount: 0,
      totalBytes: 0,
      recorderState: "n/a",
      fileMimeType: attachment?.mimeType ?? null,
      fileSize: attachment?.sizeBytes ?? null,
      durationMs: attachment?.durationMs ?? null,
      supabaseErrorCode: response.error.code,
      operation: "conversation_message_send",
    });
    return { ok: false, error: mapError(response.error, "conversation_message_send") };
  }

  logRecorderDiagnostics({
    stage: "IOS_MESSAGE_SEND",
    selectedMimeType: null,
    recorderMimeType: "",
    chunkMimeType: null,
    chunkCount: 0,
    totalBytes: 0,
    recorderState: "n/a",
    fileMimeType: attachment?.mimeType ?? null,
    fileSize: attachment?.sizeBytes ?? null,
    durationMs: attachment?.durationMs ?? null,
    supabaseErrorCode: response.error.code,
    operation: "conversation_message_send",
  });
  return {
    ok: false,
    error: {
      code: "setup_required",
      message: "إرسال الرسائل الآمن غير متاح حالياً. حاول لاحقاً.",
      operation: "conversation_message_send",
    },
  };
}

function isMissingMessageSendV4(error: {
  code?: string;
  message?: string;
  details?: string;
}): boolean {
  const value = `${error.message ?? ""} ${error.details ?? ""}`;
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    value.includes("rawaj_send_conversation_message_v4")
  );
}

function isMissingMessageSendV3(error: {
  code?: string;
  message?: string;
  details?: string;
}): boolean {
  const message = error.message ?? "";
  const details = error.details ?? "";
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    message.includes("rawaj_send_conversation_message_v3") ||
    details.includes("rawaj_send_conversation_message_v3")
  );
}

function isMessageRequestPayloadMismatch(error: { message?: string; details?: string }): boolean {
  return `${error.message ?? ""} ${error.details ?? ""}`.includes(
    "message_request_payload_mismatch",
  );
}

async function getAuthenticatedUserId(client: SupabaseClient): Promise<ClassifiedsResult<string>> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.id) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لإكمال هذا الإجراء." },
    };
  }
  return { ok: true, data: data.user.id };
}

export async function markConversationRead(
  conversationId: string,
): Promise<ClassifiedsResult<null>> {
  const cleanConversationId = normalizeChatResourceId(conversationId);
  if (!cleanConversationId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد المحادثة." },
    };
  }
  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<{ success: boolean }>(
      `/v1/conversations/${encodeURIComponent(cleanConversationId)}/read`,
      { method: "POST", body: {} },
    );
    if (!result.ok) return { ok: false, error: { code: "unknown", message: result.error } };
    emitUnreadActivityChanged();
    return { ok: true, data: null };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data.rpc("rawaj_mark_conversation_read", {
    p_conversation_id: cleanConversationId,
  });

  if (error) return { ok: false, error: mapError(error) };
  emitUnreadActivityChanged();
  return { ok: true, data: null };
}

export async function createMessageReport(
  payload: CreateMessageReportPayload,
): Promise<ClassifiedsResult<null>> {
  const reason = normalizeModerationText(payload.reason, 80);
  const details = normalizeModerationText(payload.details ?? "", 1000) || null;
  const messageId = normalizeChatResourceId(payload.messageId);
  if (!messageId || !isMessageReportReason(reason) || (reason === "other" && !details)) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اختر سبباً واضحاً للبلاغ." },
    };
  }
  if (isCloudflarePublicDataProvider()) {
    return {
      ok: false,
      error: {
        code: "setup_required",
        message: "بلاغات الرسائل ستتاح بعد نقل أدوات الإشراف إلى Cloudflare.",
      },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const actorResult = await getAuthenticatedUserId(clientResult.data);
  if (!actorResult.ok) return actorResult;

  const messageResult = await clientResult.data
    .from("conversation_messages")
    .select("id,conversation_id")
    .eq("id", messageId)
    .is("deleted_at", null)
    .maybeSingle();
  if (messageResult.error) return { ok: false, error: mapError(messageResult.error) };
  const conversationId = rowString(
    (messageResult.data ?? {}) as Record<string, unknown>,
    "conversation_id",
  );
  if (!conversationId) {
    return { ok: false, error: { code: "not_found", message: "تعذر العثور على الرسالة." } };
  }

  const rpcResult = await clientResult.data.rpc("rawaj_create_message_report", {
    p_message_id: messageId,
    p_conversation_id: conversationId,
    p_reason: reason,
    p_details: details,
  });

  if (!rpcResult.error) {
    const current = await accountSessionStillMatches(
      clientResult.data,
      actorResult.data,
      "message_report_stale",
    );
    if (!current.ok) return current;
    return { ok: true, data: null };
  }

  if (isMissingMessageReportRpc(rpcResult.error)) {
    return {
      ok: false,
      error: {
        code: "setup_required",
        message: "بلاغات الرسائل تحتاج تفعيل إعدادات الحماية من الإدارة قبل استخدامها.",
        details: rpcResult.error.message,
      },
    };
  }

  return {
    ok: false,
    error: mapModerationError(
      rpcResult.error,
      "message_report_create",
      "تعذر إرسال بلاغ الرسالة الآن.",
    ),
  };
}

export async function blockConversationParticipant(
  payload: BlockConversationPayload,
): Promise<ClassifiedsResult<null>> {
  const conversationId = normalizeChatResourceId(payload.conversationId);
  if (!conversationId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد المستخدم المطلوب حظره." },
    };
  }
  if (isCloudflarePublicDataProvider()) {
    return {
      ok: false,
      error: {
        code: "setup_required",
        message: "حظر مستخدمي المحادثة سيتاح بعد نقل أدوات الإشراف إلى Cloudflare.",
      },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const actorResult = await getAuthenticatedUserId(clientResult.data);
  if (!actorResult.ok) return actorResult;

  const { error } = await clientResult.data.rpc("rawaj_block_conversation_participant", {
    p_conversation_id: conversationId,
    p_reason: normalizeModerationText(payload.reason ?? "", 300) || null,
  });

  if (error) {
    return {
      ok: false,
      error: mapModerationError(error, "conversation_block", "تعذر حظر المستخدم الآن."),
    };
  }
  const current = await accountSessionStillMatches(
    clientResult.data,
    actorResult.data,
    "conversation_block_stale",
  );
  if (!current.ok) return current;
  return { ok: true, data: null };
}

function mapConversation(row: Record<string, unknown>): Conversation {
  return {
    id: rowString(row, "id"),
    listingId: rowNullableString(row, "listing_id"),
    listingTitle: rowString(row, "listing_title", "إعلان على رواجا"),
    status: rowString(row, "status", "active") as ConversationStatus,
    otherParticipant: {
      displayName: rowString(row, "other_display_name", "مستخدم رواجا"),
      avatarUrl: rowNullableString(row, "other_avatar_url"),
    },
    lastMessageAt: rowNullableString(row, "last_message_at"),
    lastMessagePreview: rowNullableString(row, "last_message_preview"),
    unreadCount: rowNumber(row, "unread_count"),
    otherLastReadAt: rowNullableString(row, "other_last_read_at"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}

function mapMessage(row: Record<string, unknown>, actorUserId: string): ConversationMessage {
  return {
    id: rowString(row, "id"),
    conversationId: rowString(row, "conversation_id"),
    isMine: rowString(row, "sender_user_id") === actorUserId,
    body: rowString(row, "body"),
    attachmentPath: rowNullableString(row, "attachment_path"),
    attachmentMimeType: rowNullableString(row, "attachment_mime_type"),
    attachmentSizeBytes:
      rowNullableString(row, "attachment_path") === null
        ? null
        : rowNumber(row, "attachment_size_bytes"),
    attachmentKind: (() => {
      const value = rowNullableString(row, "attachment_kind");
      return value === "audio" || value === "image"
        ? value
        : rowNullableString(row, "attachment_path")
          ? "image"
          : null;
    })(),
    attachmentDurationMs:
      rowNullableString(row, "attachment_kind") === "audio"
        ? rowNumber(row, "attachment_duration_ms")
        : null,
    attachmentUrl: null,
    createdAt: rowString(row, "created_at"),
    editedAt: rowNullableString(row, "edited_at"),
    deletedAt: rowNullableString(row, "deleted_at"),
  };
}

function mapCloudflareMessage(row: Record<string, unknown>): ConversationMessage {
  return {
    id: rowString(row, "id"),
    conversationId: rowString(row, "conversation_id"),
    isMine: rowBoolean(row, "is_mine"),
    body: rowString(row, "body"),
    attachmentPath: null,
    attachmentMimeType: null,
    attachmentSizeBytes: null,
    attachmentKind: null,
    attachmentDurationMs: null,
    attachmentUrl: null,
    createdAt: rowString(row, "created_at"),
    editedAt: null,
    deletedAt: rowNullableString(row, "deleted_at"),
  };
}

function attachmentMigrationPending<T>(): ClassifiedsResult<T> {
  return {
    ok: false,
    error: {
      code: "setup_required",
      message: "مرفقات المحادثة غير متاحة مؤقتًا أثناء نقل التخزين إلى Cloudflare.",
    },
  };
}

export function fromDbMessageReportStatus(status: string): MessageReport["status"] {
  if (["new", "under_review", "resolved", "rejected"].includes(status)) {
    return status as MessageReport["status"];
  }
  return "new";
}

export function toDbMessageReportStatus(status: MessageReport["status"]): string {
  return status;
}

function mapMessageReport(row: Record<string, unknown>): MessageReport {
  return {
    id: rowString(row, "id"),
    messageId: rowNullableString(row, "message_id"),
    conversationId: rowNullableString(row, "conversation_id"),
    reporterUserId: rowString(row, "reporter_user_id"),
    reportedUserId: rowString(row, "reported_user_id"),
    reason: rowString(row, "reason"),
    details: rowNullableString(row, "details"),
    status: fromDbMessageReportStatus(rowString(row, "status", "new")),
    adminNote: rowNullableString(row, "admin_note"),
    reviewedBy: rowNullableString(row, "reviewed_by"),
    reviewedAt: rowNullableString(row, "reviewed_at"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
    messageBody: rowNullableString(row, "message_body"),
    listingId: rowNullableString(row, "listing_id"),
    listingTitle: rowNullableString(row, "listing_title"),
    reporterDisplayName: rowNullableString(row, "reporter_display_name"),
    reportedDisplayName: rowNullableString(row, "reported_display_name"),
  };
}

export async function adminFetchMessageReports(): Promise<ClassifiedsResult<MessageReport[]>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_fetch_message_reports_for_admin");
  if (error) {
    return {
      ok: false,
      error: mapModerationError(error, "message_report_admin_queue", "تعذر تحميل بلاغات الرسائل."),
    };
  }
  return { ok: true, data: ((data ?? []) as Record<string, unknown>[]).map(mapMessageReport) };
}

export async function adminModerateMessageReport(payload: {
  reportId: string;
  status: MessageReportStatus;
  adminNote?: string | null;
  expectedUpdatedAt: string;
}): Promise<ClassifiedsResult<null>> {
  if (!payload.reportId.trim() || !payload.expectedUpdatedAt) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد بلاغ الرسالة أو نسخته الحالية." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data.rpc("rawaj_admin_moderate_message_report", {
    p_report_id: payload.reportId,
    p_status: toDbMessageReportStatus(payload.status),
    p_admin_note: normalizeModerationText(payload.adminNote ?? "", 1000) || null,
    p_expected_updated_at: payload.expectedUpdatedAt,
  });

  if (error) {
    return {
      ok: false,
      error: mapModerationError(error, "message_report_moderate", "تعذر تحديث بلاغ الرسالة."),
    };
  }

  return { ok: true, data: null };
}
