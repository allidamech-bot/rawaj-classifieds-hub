import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClassifiedsResult,
  Conversation,
  ConversationMessage,
  ConversationStatus,
  CreateMessageReportPayload,
  MessageReport,
  MessageReportStatus,
} from "@/lib/classifieds-types";
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
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<string>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لبدء محادثة." },
    };
  }

  if (!listingId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان لبدء المحادثة." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_start_listing_conversation", {
    p_listing_id: listingId,
  });

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: typeof data === "string" ? data : String(data) };
}

export async function fetchMyConversations(
  userId: string | null,
): Promise<ClassifiedsResult<Conversation[]>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض المحادثات." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_fetch_my_conversations");
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Record<string, unknown>[]).map(mapConversation) };
}

export async function fetchConversationMessages(
  userId: string | null,
  conversationId: string,
): Promise<ClassifiedsResult<ConversationMessage[]>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض الرسائل." },
    };
  }

  if (!conversationId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد المحادثة." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("conversation_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return { ok: false, error: mapError(error) };
  const rows = ((data ?? []) as Record<string, unknown>[]).reverse();
  return { ok: true, data: rows.map(mapMessage) };
}

export async function sendConversationMessage(
  userId: string | null,
  conversationId: string,
  body: string,
): Promise<ClassifiedsResult<ConversationMessage>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لإرسال رسالة." },
    };
  }

  const cleanConversationId = conversationId.trim();
  const cleanBody = body.trim();
  if (!cleanConversationId || cleanBody.length < 1 || cleanBody.length > 2000) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اكتب رسالة بين 1 و2000 حرف." },
    };
  }

  const sendKey = JSON.stringify([userId, cleanConversationId, cleanBody]);
  const existingSend = pendingMessageSends.get(sendKey);
  if (existingSend) return existingSend;

  const sendPromise = performConversationMessageSend(userId, cleanConversationId, cleanBody);
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
  userId: string,
  conversationId: string,
  cleanBody: string,
): Promise<ClassifiedsResult<ConversationMessage>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("conversation_messages")
    .insert({
      conversation_id: conversationId,
      sender_user_id: userId,
      body: cleanBody,
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: mapMessage(data as Record<string, unknown>) };
}

export async function markConversationRead(
  userId: string | null,
  conversationId: string,
): Promise<ClassifiedsResult<null>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتحديث المحادثة." },
    };
  }

  if (!conversationId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد المحادثة." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data.rpc("rawaj_mark_conversation_read", {
    p_conversation_id: conversationId,
  });

  if (error) return { ok: false, error: mapError(error) };
  emitUnreadActivityChanged();
  return { ok: true, data: null };
}

export async function createMessageReport(
  payload: CreateMessageReportPayload,
): Promise<ClassifiedsResult<MessageReport>> {
  if (!payload.reporterUserId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول للإبلاغ عن رسالة." },
    };
  }

  const reason = payload.reason.trim();
  const details = payload.details?.trim() || null;
  if (!payload.messageId.trim() || !payload.conversationId.trim() || reason.length < 3) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اختر سبباً واضحاً للبلاغ." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const rpcResult = await clientResult.data.rpc("rawaj_create_message_report", {
    p_message_id: payload.messageId,
    p_conversation_id: payload.conversationId,
    p_reason: reason,
    p_details: details,
  });

  if (!rpcResult.error) {
    return { ok: true, data: mapMessageReport(rpcResult.data as Record<string, unknown>) };
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

export async function blockConversationParticipant(payload: {
  blockerUserId: string | null;
  conversationId: string;
  blockedUserId: string;
  reason?: string | null;
}): Promise<ClassifiedsResult<null>> {
  if (!payload.blockerUserId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لحظر مستخدم." },
    };
  }

  if (
    !payload.conversationId.trim() ||
    !payload.blockedUserId.trim() ||
    payload.blockedUserId === payload.blockerUserId
  ) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد المستخدم المطلوب حظره." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data.from("user_blocks").insert({
    conversation_id: payload.conversationId,
    blocker_user_id: payload.blockerUserId,
    blocked_user_id: payload.blockedUserId,
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
    buyerUserId: rowString(row, "buyer_user_id"),
    sellerUserId: rowString(row, "seller_user_id"),
    status: rowString(row, "status", "active") as ConversationStatus,
    otherParticipant: {
      userId: rowString(row, "other_user_id"),
      displayName: rowString(row, "other_display_name", "مستخدم رواجا"),
      avatarUrl: rowNullableString(row, "other_avatar_url"),
      governorate: rowNullableString(row, "other_governorate"),
    },
    lastMessageAt: rowNullableString(row, "last_message_at"),
    lastMessagePreview: rowNullableString(row, "last_message_preview"),
    unreadCount: rowNumber(row, "unread_count"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}

function mapMessage(row: Record<string, unknown>): ConversationMessage {
  return {
    id: rowString(row, "id"),
    conversationId: rowString(row, "conversation_id"),
    senderUserId: rowString(row, "sender_user_id"),
    body: rowString(row, "body"),
    createdAt: rowString(row, "created_at"),
    editedAt: rowNullableString(row, "edited_at"),
    deletedAt: rowNullableString(row, "deleted_at"),
  };
}

export function fromDbMessageReportStatus(status: string): MessageReport["status"] {
  if (status === "in_review") return "under_review";
  if (status === "dismissed") return "rejected";
  if (["new", "under_review", "resolved", "rejected"].includes(status)) {
    return status as MessageReport["status"];
  }
  return "new";
}

export function toDbMessageReportStatus(status: MessageReport["status"]): string {
  if (status === "under_review") return "in_review";
  if (status === "rejected") return "dismissed";
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
  payload: { reportId: string; status: MessageReportStatus; adminNote?: string | null },
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

  if (!payload.reportId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد بلاغ الرسالة." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data
    .from("message_reports")
    .update({
      status: toDbMessageReportStatus(payload.status),
      admin_note: payload.adminNote?.trim() || null,
    })
    .eq("id", payload.reportId);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}
