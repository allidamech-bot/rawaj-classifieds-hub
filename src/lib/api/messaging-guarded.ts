import {
  adminFetchMessageReports,
  adminModerateMessageReport,
  blockConversationParticipant as baseBlockConversationParticipant,
  createMessageReport as baseCreateMessageReport,
  fetchConversationMessages,
  fetchMyConversations,
  fromDbMessageReportStatus,
  markConversationRead,
  sendConversationMessage as baseSendConversationMessage,
  startListingConversation as baseStartListingConversation,
  toDbMessageReportStatus,
} from "@/lib/api/messaging";
import { completeMessageSendRequest } from "@/lib/api/message-send-request";

const pendingConversationStarts = new Map<
  string,
  ReturnType<typeof baseStartListingConversation>
>();
const pendingMessageReports = new Map<
  string,
  ReturnType<typeof baseCreateMessageReport>
>();
const pendingParticipantBlocks = new Map<
  string,
  ReturnType<typeof baseBlockConversationParticipant>
>();

function runOnce<T>(
  key: string,
  requests: Map<string, Promise<T>>,
  operation: () => Promise<T>,
) {
  const pending = requests.get(key);
  if (pending) return pending;

  const request = operation().finally(() => {
    if (requests.get(key) === request) requests.delete(key);
  });
  requests.set(key, request);
  return request;
}

export function startListingConversation(
  userId: string | null,
  listingId: string,
) {
  const cleanListingId = listingId.trim();
  return runOnce(
    JSON.stringify([userId ?? "anonymous", cleanListingId]),
    pendingConversationStarts,
    () => baseStartListingConversation(userId, cleanListingId),
  );
}

export async function sendConversationMessage(
  ...args: Parameters<typeof baseSendConversationMessage>
): ReturnType<typeof baseSendConversationMessage> {
  const result = await baseSendConversationMessage(...args);
  const [userId, conversationId, , requestId] = args;
  if (result.ok && userId) {
    completeMessageSendRequest(userId, conversationId, requestId);
  }
  return result;
}

export function createMessageReport(
  payload: Parameters<typeof baseCreateMessageReport>[0],
) {
  const key = JSON.stringify([
    payload.reporterUserId ?? "anonymous",
    payload.messageId.trim(),
    payload.conversationId.trim(),
    payload.reason.trim(),
    payload.details?.trim() ?? "",
  ]);
  return runOnce(key, pendingMessageReports, () =>
    baseCreateMessageReport(payload),
  );
}

export function blockConversationParticipant(
  payload: Parameters<typeof baseBlockConversationParticipant>[0],
) {
  const key = JSON.stringify([
    payload.blockerUserId ?? "anonymous",
    payload.conversationId.trim(),
    payload.blockedUserId.trim(),
    payload.reason?.trim() ?? "",
  ]);
  return runOnce(key, pendingParticipantBlocks, () =>
    baseBlockConversationParticipant(payload),
  );
}

export {
  adminFetchMessageReports,
  adminModerateMessageReport,
  fetchConversationMessages,
  fetchMyConversations,
  fromDbMessageReportStatus,
  markConversationRead,
  toDbMessageReportStatus,
};
