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

const pendingMessageSends = new Map<string, Promise<ClassifiedsResult<ConversationMessage>>>();

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

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_start_listing_conversation", {
    p_listing_id: cleanListingId,
  });

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: typeof data === "string" ? data : String(data) };
}

export async function fetchMyConversations(): Promise<ClassifiedsResult<Conversation[]>> {
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

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const actorResult = await getAuthenticatedUserId(clientResult.data);
  if (!actorResult.ok) return actorResult;

  const { data, error } = await clientResult.data
    .from("conversation_messages")
    .select("id,conversation_id,sender_user_id,body,created_at,edited_at,deleted_at")
    .eq("conversation_id", cleanConversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CHAT_HISTORY_PAGE_SIZE);

  if (error) return { ok: false, error: mapError(error) };
  const rows = (data ?? []) as Record<string, unknown>[];
  return {
    ok: true,
    data: sortAndDedupeMessages(
      rows.map((row) => mapMessage(row, actorResult.data)),
      cleanConversationId,
    ),
  };
}

const MESSAGE_REQUEST_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function sendConversationMessage(payload: {
  conversationId: string;
  body: string;
  requestId: string;
}): Promise<ClassifiedsResult<ConversationMessage>> {
  const cleanConversationId = normalizeChatResourceId(payload.conversationId);
  const cleanBody = payload.body.trim();
  const cleanRequestId = payload.requestId.trim();
  if (!cleanConversationId || cleanBody.length < 1 || cleanBody.length > CHAT_MESSAGE_MAX_LENGTH) {
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
): Promise<ClassifiedsResult<ConversationMessage>> {
  const response = await client.rpc("rawaj_send_conversation_message_v2", {
    p_conversation_id: conversationId,
    p_client_request_id: clientRequestId,
    p_body: cleanBody,
  });

  if (!response.error) {
    const row = ((response.data ?? []) as Record<string, unknown>[])[0];
    if (row) return { ok: true, data: mapMessage(row, actorUserId) };
    return {
      ok: false,
      error: {
        code: "unknown",
        message: "تم إرسال طلب الرسالة دون نتيجة قابلة للتحقق.",
        operation: "conversation_message_send",
      },
    };
  }

  if (!isMissingMessageSendV2(response.error)) {
    if (isMessageRequestPayloadMismatch(response.error)) {
      return {
        ok: false,
        error: {
          code: "validation_error",
          message: "تغير محتوى محاولة الإرسال. أعد كتابة الرسالة ثم أرسلها مجدداً.",
          operation: "conversation_message_send",
        },
      };
    }
    return { ok: false, error: mapError(response.error, "conversation_message_send") };
  }

  return {
    ok: false,
    error: {
      code: "setup_required",
      message: "إرسال الرسائل الآمن غير متاح حالياً. حاول لاحقاً.",
      operation: "conversation_message_send",
    },
  };
}

function isMissingMessageSendV2(error: {
  code?: string;
  message?: string;
  details?: string;
}): boolean {
  const message = error.message ?? "";
  const details = error.details ?? "";
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    message.includes("rawaj_send_conversation_message_v2") ||
    details.includes("rawaj_send_conversation_message_v2")
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
  const reason = payload.reason.trim();
  const details = payload.details?.trim() || null;
  const messageId = normalizeChatResourceId(payload.messageId);
  if (!messageId || reason.length < 3) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اختر سبباً واضحاً للبلاغ." },
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

  return { ok: false, error: mapError(rpcResult.error) };
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

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const actorResult = await getAuthenticatedUserId(clientResult.data);
  if (!actorResult.ok) return actorResult;

  const conversationResult = await clientResult.data.rpc("rawaj_fetch_my_conversations");
  if (conversationResult.error) return { ok: false, error: mapError(conversationResult.error) };
  const conversation = ((conversationResult.data ?? []) as Record<string, unknown>[]).find(
    (row) => rowString(row, "id") === conversationId,
  );
  const blockedUserId = conversation ? rowString(conversation, "other_user_id") : "";
  if (!blockedUserId || blockedUserId === actorResult.data) {
    return { ok: false, error: { code: "not_found", message: "تعذر العثور على المحادثة." } };
  }

  const { error } = await clientResult.data.from("user_blocks").insert({
    conversation_id: conversationId,
    blocker_user_id: actorResult.data,
    blocked_user_id: blockedUserId,
    reason: payload.reason?.trim() || null,
  });

  if (error) return { ok: false, error: mapError(error) };
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
    createdAt: rowString(row, "created_at"),
    editedAt: rowNullableString(row, "edited_at"),
    deletedAt: rowNullableString(row, "deleted_at"),
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
    messageId: rowString(row, "message_id"),
    conversationId: rowString(row, "conversation_id"),
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

export async function adminFetchMessageReports(
  canUseAdminAccess: boolean,
): Promise<ClassifiedsResult<MessageReport[]>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "مراجعة بلاغات الرسائل متاحة لحساب إداري مخول فقط.",
      },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_fetch_message_reports_for_admin");
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Record<string, unknown>[]).map(mapMessageReport) };
}

export async function adminModerateMessageReport(
  canUseAdminAccess: boolean,
  payload: {
    reportId: string;
    status: MessageReportStatus;
    adminNote?: string | null;
    expectedUpdatedAt: string;
  },
): Promise<ClassifiedsResult<null>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "مراجعة بلاغات الرسائل متاحة لحساب إداري مخول فقط.",
      },
    };
  }

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
    p_admin_note: payload.adminNote?.trim() || null,
    p_expected_updated_at: payload.expectedUpdatedAt,
  });

  if (error) {
    if (error.message?.includes("stale_message_report")) {
      return {
        ok: false,
        error: {
          code: "stale_review",
          message: "تغيّر بلاغ الرسالة منذ تحميله. أعد تحميل القائمة قبل اتخاذ قرار جديد.",
        },
      };
    }
    return { ok: false, error: mapError(error) };
  }

  return { ok: true, data: null };
}
