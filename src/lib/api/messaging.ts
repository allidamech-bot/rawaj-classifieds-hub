import type {
  BlockConversationPayload,
  ClassifiedsErrorCode,
  ClassifiedsResult,
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
import { isMessageReportReason, normalizeModerationText } from "@/lib/moderation-contract";
import { logRecorderDiagnostics } from "@/lib/chat-audio-diagnostics";
import {
  cloudflareApiRequest,
  cloudflareAuthorizedFetch,
} from "@/lib/cloudflare-auth";

const pendingMessageSends = new Map<string, Promise<ClassifiedsResult<ConversationMessage>>>();
const chatMediaObjectUrls = new Map<string, { url: string; expiresAt: number }>();
const CHAT_MEDIA_OBJECT_URL_TTL_MS = 15 * 60_000;

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

type UploadedChatAttachment = UploadedChatImage | UploadedChatAudio;

type ApiFailure = { ok: false; error: string; code: string };

export function validateChatImage(file: File): ClassifiedsResult<null> {
  if (!CHAT_IMAGE_MIME_TYPES.includes(file.type as UploadedChatImage["mimeType"])) {
    return failure("validation_error", "اختر صورة JPG أو PNG أو WebP.");
  }
  if (file.size < 1 || file.size > CHAT_IMAGE_MAX_BYTES) {
    return failure("validation_error", "يجب ألا يتجاوز حجم الصورة 5 ميغابايت.");
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
      ? failure("validation_error", "تعذر تحديد مرفق المحادثة.")
      : validation;
  }

  const form = new FormData();
  form.set("file", payload.file, payload.file.name);
  form.set("requestId", requestId);
  form.set("kind", "image");
  const result = await cloudflareApiRequest<UploadedChatAttachment>(
    `/v1/conversations/${encodeURIComponent(conversationId)}/attachments`,
    { method: "POST", body: form },
  );
  if (!result.ok) return apiFailure(result, "chat_image_upload");
  if (result.data.kind !== "image") {
    return failure("unknown", "أعاد الخادم نوع مرفق غير متوقع.", "chat_image_upload");
  }
  return { ok: true, data: result.data };
}

export async function removeChatImage(path: string): Promise<void> {
  await removeChatMedia(path);
}

export async function createChatImageSignedUrl(path: string): Promise<string | null> {
  return downloadChatMediaObjectUrl(path);
}

function extensionForChatAudioMime(mimeType: string): string {
  if (mimeType === "audio/mp4") return "m4a";
  if (mimeType === "audio/mpeg") return "mp3";
  if (mimeType === "audio/ogg") return "ogg";
  return "webm";
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
  const raw = value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return CHAT_AUDIO_MIME_ALIASES[raw] ?? null;
}

function normalizeChatAudioFileName(originalName: string, mimeType: string): string {
  const extension = extensionForChatAudioMime(mimeType);
  const base =
    originalName.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}_-]+/gu, "-") || "voice";
  return `${base}.${extension}`;
}

export function validateChatAudio(file: File, durationMs: number): ClassifiedsResult<null> {
  const mimeType = normalizeChatAudioMimeType(file.type);
  if (!mimeType) {
    return failure("validation_error", "صيغة التسجيل الصوتي غير مدعومة.", "chat_audio_validation");
  }
  if (file.size < 1 || file.size > CHAT_AUDIO_MAX_BYTES) {
    return failure("validation_error", "يجب ألا يتجاوز التسجيل 10 ميغابايت.");
  }
  if (durationMs < 1_000 || durationMs > CHAT_AUDIO_MAX_DURATION_MS) {
    return failure("validation_error", "يجب أن يكون التسجيل بين ثانية واحدة و120 ثانية.");
  }
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
  const durationMs = Number.isFinite(payload.durationMs) ? Math.trunc(payload.durationMs) : 0;
  const validation = validateChatAudio(payload.file, durationMs);
  if (!mimeType || !conversationId || !requestId || !validation.ok) {
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
      ? failure("validation_error", "تعذر تحديد التسجيل الصوتي.", "chat_audio_validation")
      : validation;
  }

  let normalizedFile: File;
  try {
    normalizedFile = new File(
      [await payload.file.arrayBuffer()],
      normalizeChatAudioFileName(payload.file.name, mimeType),
      { type: mimeType },
    );
  } catch (error) {
    logRecorderDiagnostics({
      stage: "IOS_PREPARE",
      selectedMimeType: mimeType,
      recorderMimeType: "",
      chunkMimeType: null,
      chunkCount: 0,
      totalBytes: 0,
      recorderState: "n/a",
      fileMimeType: mimeType,
      fileSize: payload.file.size,
      durationMs,
      operation: "chat_audio_prepare",
      errorName: error instanceof Error ? error.name : undefined,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return failure(
      "validation_error",
      "تعذر تجهيز التسجيل الصوتي للإرسال. أعد تسجيله ثم حاول مجدداً.",
      "chat_audio_prepare",
    );
  }

  const form = new FormData();
  form.set("file", normalizedFile, normalizedFile.name);
  form.set("requestId", requestId);
  form.set("kind", "audio");
  form.set("durationMs", String(durationMs));
  const result = await cloudflareApiRequest<UploadedChatAttachment>(
    `/v1/conversations/${encodeURIComponent(conversationId)}/attachments`,
    { method: "POST", body: form },
  );
  if (!result.ok) {
    logRecorderDiagnostics({
      stage: "IOS_UPLOAD",
      selectedMimeType: mimeType,
      recorderMimeType: "",
      chunkMimeType: null,
      chunkCount: 0,
      totalBytes: 0,
      recorderState: "n/a",
      fileMimeType: mimeType,
      fileSize: normalizedFile.size,
      durationMs,
      operation: "chat_audio_upload",
      errorMessage: result.error,
    });
    return apiFailure(result, "chat_audio_upload");
  }
  if (result.data.kind !== "audio") {
    return failure("unknown", "أعاد الخادم نوع مرفق غير متوقع.", "chat_audio_upload");
  }
  return { ok: true, data: result.data };
}

export async function removeChatAudio(path: string): Promise<void> {
  await removeChatMedia(path);
}

export async function createChatAudioSignedUrl(path: string): Promise<string | null> {
  return downloadChatMediaObjectUrl(path);
}

export async function downloadChatAudioObjectUrl(path: string): Promise<string | null> {
  return downloadChatMediaObjectUrl(path);
}

async function removeChatMedia(path: string): Promise<void> {
  const assetId = normalizeChatResourceId(path);
  if (!assetId) return;
  await cloudflareApiRequest<{ success: boolean }>(
    `/v1/account/chat-media/${encodeURIComponent(assetId)}`,
    { method: "DELETE" },
  );
  const cached = chatMediaObjectUrls.get(assetId);
  if (cached && typeof URL !== "undefined") URL.revokeObjectURL(cached.url);
  chatMediaObjectUrls.delete(assetId);
}

async function downloadChatMediaObjectUrl(path: string): Promise<string | null> {
  const assetId = normalizeChatResourceId(path);
  if (!assetId || typeof URL === "undefined") return null;
  const cached = chatMediaObjectUrls.get(assetId);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  if (cached) {
    URL.revokeObjectURL(cached.url);
    chatMediaObjectUrls.delete(assetId);
  }

  const response = await cloudflareAuthorizedFetch(
    `/v1/account/chat-media/${encodeURIComponent(assetId)}`,
  );
  if (!response?.ok) return null;
  const blob = await response.blob();
  if (!blob.size) return null;
  const url = URL.createObjectURL(blob);
  const expiresAt = Date.now() + CHAT_MEDIA_OBJECT_URL_TTL_MS;
  chatMediaObjectUrls.set(assetId, { url, expiresAt });
  setTimeout(() => {
    const current = chatMediaObjectUrls.get(assetId);
    if (!current || current.url !== url || current.expiresAt > Date.now()) return;
    URL.revokeObjectURL(url);
    chatMediaObjectUrls.delete(assetId);
  }, CHAT_MEDIA_OBJECT_URL_TTL_MS + 1_000);
  return url;
}

export async function startListingConversation(
  listingId: string,
): Promise<ClassifiedsResult<string>> {
  const cleanListingId = normalizeChatResourceId(listingId);
  if (!cleanListingId) {
    return failure("validation_error", "تعذر تحديد الإعلان لبدء المحادثة.");
  }
  const result = await cloudflareApiRequest<{ id: string }>("/v1/conversations", {
    method: "POST",
    body: { listingId: cleanListingId },
  });
  return result.ok
    ? { ok: true, data: result.data.id }
    : apiFailure(result, "conversation_start");
}

export async function fetchMyConversations(): Promise<ClassifiedsResult<Conversation[]>> {
  const result = await cloudflareApiRequest<{ items: Record<string, unknown>[] }>(
    "/v1/account/conversations?pageSize=50",
  );
  return result.ok
    ? {
        ok: true,
        data: sortAndDedupeConversations(result.data.items.map(mapConversation)),
      }
    : apiFailure(result, "conversation_list");
}

export async function fetchConversationMessages(
  conversationId: string,
): Promise<ClassifiedsResult<ConversationMessage[]>> {
  const cleanConversationId = normalizeChatResourceId(conversationId);
  if (!cleanConversationId) return failure("validation_error", "تعذر تحديد المحادثة.");
  const result = await cloudflareApiRequest<{ items: Record<string, unknown>[] }>(
    `/v1/conversations/${encodeURIComponent(cleanConversationId)}/messages?pageSize=${CHAT_HISTORY_PAGE_SIZE}`,
  );
  if (!result.ok) return apiFailure(result, "conversation_messages_read");

  const messages = result.data.items.map(mapCloudflareMessage);
  const hydrated = await Promise.all(
    messages.map(async (message) => {
      if (!message.attachmentPath) return message;
      const attachmentUrl =
        message.attachmentKind === "audio"
          ? await createChatAudioSignedUrl(message.attachmentPath)
          : await createChatImageSignedUrl(message.attachmentPath);
      return { ...message, attachmentUrl };
    }),
  );
  return { ok: true, data: sortAndDedupeMessages(hydrated, cleanConversationId) };
}

const MESSAGE_REQUEST_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    return failure("validation_error", "اكتب رسالة بين 1 و2000 حرف أو أرفق ملفاً صالحاً.");
  }
  if (!MESSAGE_REQUEST_UUID_PATTERN.test(cleanRequestId)) {
    return failure("validation_error", "تعذر تحديد محاولة إرسال الرسالة.");
  }
  if (attachment && !normalizeChatResourceId(attachment.path)) {
    return failure("validation_error", "تعذر تحديد مرفق الرسالة.");
  }

  const sendKey = `${cleanConversationId}:${cleanRequestId}`;
  const pending = pendingMessageSends.get(sendKey);
  if (pending) return pending;

  const request = cloudflareApiRequest<Record<string, unknown>>(
    `/v1/conversations/${encodeURIComponent(cleanConversationId)}/messages`,
    {
      method: "POST",
      body: {
        body: cleanBody,
        requestId: cleanRequestId,
        attachment: attachment
          ? {
              path: attachment.path,
              mimeType: attachment.mimeType,
              sizeBytes: attachment.sizeBytes,
              kind: attachment.kind,
              durationMs: attachment.durationMs,
            }
          : null,
      },
    },
  ).then(async (result): Promise<ClassifiedsResult<ConversationMessage>> => {
    if (!result.ok) return apiFailure(result, "conversation_message_send");
    const message = mapCloudflareMessage({ ...result.data, is_mine: 1 });
    if (!message.attachmentPath) return { ok: true, data: message };
    const attachmentUrl =
      message.attachmentKind === "audio"
        ? await createChatAudioSignedUrl(message.attachmentPath)
        : await createChatImageSignedUrl(message.attachmentPath);
    return { ok: true, data: { ...message, attachmentUrl } };
  });
  pendingMessageSends.set(sendKey, request);
  try {
    return await request;
  } finally {
    if (pendingMessageSends.get(sendKey) === request) pendingMessageSends.delete(sendKey);
  }
}

export async function markConversationRead(
  conversationId: string,
): Promise<ClassifiedsResult<null>> {
  const cleanConversationId = normalizeChatResourceId(conversationId);
  if (!cleanConversationId) return failure("validation_error", "تعذر تحديد المحادثة.");
  const result = await cloudflareApiRequest<{ success: boolean }>(
    `/v1/conversations/${encodeURIComponent(cleanConversationId)}/read`,
    { method: "POST", body: {} },
  );
  if (!result.ok) return apiFailure(result, "conversation_mark_read");
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
    return failure("validation_error", "اختر سبباً واضحاً للبلاغ.");
  }
  const result = await cloudflareApiRequest<{ id: string; created: boolean }>(
    `/v1/messages/${encodeURIComponent(messageId)}/report`,
    { method: "POST", body: { reason, details } },
  );
  return result.ok
    ? { ok: true, data: null }
    : apiFailure(result, "message_report_create");
}

export async function blockConversationParticipant(
  payload: BlockConversationPayload,
): Promise<ClassifiedsResult<null>> {
  const conversationId = normalizeChatResourceId(payload.conversationId);
  if (!conversationId) {
    return failure("validation_error", "تعذر تحديد المستخدم المطلوب حظره.");
  }
  const reason = normalizeModerationText(payload.reason ?? "", 300) || null;
  const result = await cloudflareApiRequest<{ success: boolean }>(
    `/v1/conversations/${encodeURIComponent(conversationId)}/block`,
    { method: "POST", body: { reason } },
  );
  return result.ok
    ? { ok: true, data: null }
    : apiFailure(result, "conversation_block");
}

export function fromDbMessageReportStatus(status: string): MessageReport["status"] {
  return ["new", "under_review", "resolved", "rejected"].includes(status)
    ? (status as MessageReport["status"])
    : "new";
}

export function toDbMessageReportStatus(status: MessageReport["status"]): string {
  return status;
}

export async function adminFetchMessageReports(): Promise<ClassifiedsResult<MessageReport[]>> {
  const result = await cloudflareApiRequest<Record<string, unknown>[]>(
    "/v1/admin/message-reports",
  );
  return result.ok
    ? { ok: true, data: result.data.map(mapMessageReport) }
    : apiFailure(result, "message_report_admin_queue");
}

export async function adminModerateMessageReport(payload: {
  reportId: string;
  status: MessageReportStatus;
  adminNote?: string | null;
  expectedUpdatedAt: string;
}): Promise<ClassifiedsResult<null>> {
  const reportId = normalizeChatResourceId(payload.reportId);
  if (!reportId || !payload.expectedUpdatedAt.trim()) {
    return failure("validation_error", "تعذر تحديد بلاغ الرسالة أو نسخته الحالية.");
  }
  const result = await cloudflareApiRequest<{ success: boolean; updatedAt: string }>(
    `/v1/admin/message-reports/${encodeURIComponent(reportId)}`,
    {
      method: "PATCH",
      body: {
        status: toDbMessageReportStatus(payload.status),
        adminNote: normalizeModerationText(payload.adminNote ?? "", 1000) || null,
        expectedUpdatedAt: payload.expectedUpdatedAt,
      },
    },
  );
  return result.ok
    ? { ok: true, data: null }
    : apiFailure(result, "message_report_moderate");
}

function mapConversation(row: Record<string, unknown>): Conversation {
  return {
    id: rowString(row, "id"),
    listingId: rowNullableString(row, "listing_id", "listingId"),
    listingTitle: rowString(row, "listing_title", "إعلان على رواج", "listingTitle"),
    status: rowString(row, "status", "active") as ConversationStatus,
    otherParticipant: {
      displayName: rowString(row, "other_display_name", "مستخدم رواج", "otherDisplayName"),
      avatarUrl: rowNullableString(row, "other_avatar_url", "otherAvatarUrl"),
    },
    lastMessageAt: rowNullableString(row, "last_message_at", "lastMessageAt"),
    lastMessagePreview: rowNullableString(row, "last_message_preview", "lastMessagePreview"),
    unreadCount: rowNumber(row, "unread_count", "unreadCount"),
    otherLastReadAt: rowNullableString(row, "other_last_read_at", "otherLastReadAt"),
    createdAt: rowString(row, "created_at", "", "createdAt"),
    updatedAt: rowString(row, "updated_at", "", "updatedAt"),
  };
}

function mapCloudflareMessage(row: Record<string, unknown>): ConversationMessage {
  const attachmentPath = rowNullableString(row, "attachment_path", "attachmentPath");
  const kind = rowNullableString(row, "attachment_kind", "attachmentKind");
  return {
    id: rowString(row, "id"),
    conversationId: rowString(row, "conversation_id", "", "conversationId"),
    isMine: rowBoolean(row, "is_mine", "isMine"),
    body: rowString(row, "body"),
    attachmentPath,
    attachmentMimeType: rowNullableString(
      row,
      "attachment_mime_type",
      "attachmentMimeType",
    ),
    attachmentSizeBytes: attachmentPath
      ? rowNumber(row, "attachment_size_bytes", "attachmentSizeBytes")
      : null,
    attachmentKind: kind === "audio" || kind === "image" ? kind : attachmentPath ? "image" : null,
    attachmentDurationMs:
      kind === "audio"
        ? rowNumber(row, "attachment_duration_ms", "attachmentDurationMs")
        : null,
    attachmentUrl: null,
    createdAt: rowString(row, "created_at", "", "createdAt"),
    editedAt: rowNullableString(row, "edited_at", "editedAt"),
    deletedAt: rowNullableString(row, "deleted_at", "deletedAt"),
  };
}

function mapMessageReport(row: Record<string, unknown>): MessageReport {
  return {
    id: rowString(row, "id"),
    messageId: rowNullableString(row, "message_id", "messageId"),
    conversationId: rowNullableString(row, "conversation_id", "conversationId"),
    reporterUserId: rowString(row, "reporter_user_id", "", "reporterUserId"),
    reportedUserId: rowString(row, "reported_user_id", "", "reportedUserId"),
    reason: rowString(row, "reason"),
    details: rowNullableString(row, "details"),
    status: fromDbMessageReportStatus(rowString(row, "status", "new")),
    adminNote: rowNullableString(row, "admin_note", "adminNote"),
    reviewedBy: rowNullableString(row, "reviewed_by", "reviewedBy"),
    reviewedAt: rowNullableString(row, "reviewed_at", "reviewedAt"),
    createdAt: rowString(row, "created_at", "", "createdAt"),
    updatedAt: rowString(row, "updated_at", "", "updatedAt"),
    messageBody: rowNullableString(row, "message_body", "messageBody"),
    listingId: rowNullableString(row, "listing_id", "listingId"),
    listingTitle: rowNullableString(row, "listing_title", "listingTitle"),
    reporterDisplayName: rowNullableString(
      row,
      "reporter_display_name",
      "reporterDisplayName",
    ),
    reportedDisplayName: rowNullableString(
      row,
      "reported_display_name",
      "reportedDisplayName",
    ),
  };
}

function apiFailure<T>(result: ApiFailure, operation: string): ClassifiedsResult<T> {
  return {
    ok: false,
    error: {
      code: normalizeApiCode(result.code),
      message: result.error || "تعذر إكمال العملية.",
      operation,
    },
  };
}

function normalizeApiCode(code: string): ClassifiedsErrorCode {
  if (
    [
      "setup_required",
      "auth_required",
      "permission_denied",
      "not_found",
      "status_mismatch",
      "rate_limited",
      "validation_error",
      "foreign_key_conflict",
    ].includes(code)
  ) {
    return code as ClassifiedsErrorCode;
  }
  if (code === "invalid_transition" || code === "stale_write") return "status_mismatch";
  return "unknown";
}

function failure<T>(
  code: ClassifiedsErrorCode,
  message: string,
  operation?: string,
): ClassifiedsResult<T> {
  return { ok: false, error: { code, message, operation } };
}

function rowValue(row: Record<string, unknown>, snake: string, camel?: string): unknown {
  return row[snake] ?? (camel ? row[camel] : undefined);
}

function rowString(
  row: Record<string, unknown>,
  key: string,
  fallback = "",
  camel?: string,
): string {
  const value = rowValue(row, key, camel);
  return typeof value === "string" ? value : fallback;
}

function rowNullableString(
  row: Record<string, unknown>,
  key: string,
  camel?: string,
): string | null {
  const value = rowValue(row, key, camel);
  return typeof value === "string" && value ? value : null;
}

function rowNumber(row: Record<string, unknown>, key: string, camel?: string): number {
  const value = rowValue(row, key, camel);
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function rowBoolean(row: Record<string, unknown>, key: string, camel?: string): boolean {
  const value = rowValue(row, key, camel);
  return value === true || value === 1 || value === "1" || value === "true";
}
