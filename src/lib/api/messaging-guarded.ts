import {
  adminFetchMessageReports,
  adminModerateMessageReport,
  blockConversationParticipant,
  createChatAudioSignedUrl,
  createChatImageSignedUrl,
  downloadChatAudioObjectUrl,
  createMessageReport,
  fetchConversationMessages as fetchConversationMessagesBase,
  fetchMyConversations,
  fromDbMessageReportStatus,
  markConversationRead,
  removeChatAudio,
  removeChatImage,
  sendConversationMessage as sendConversationMessageBase,
  startListingConversation,
  toDbMessageReportStatus,
  uploadChatAudio,
  uploadChatImage,
  validateChatAudio,
  validateChatImage,
} from "@/lib/api/messaging";
import { normalizeChatResourceId } from "@/lib/chat-integrity";
import type { ClassifiedsResult, ConversationMessage } from "@/lib/classifieds-types";

const CONVERSATION_MESSAGE_CACHE_TTL_MS = 60_000;
const conversationMessageCache = new Map<
  string,
  { expiresAt: number; result: ClassifiedsResult<ConversationMessage[]> }
>();
const conversationMessageRequests = new Map<
  string,
  Promise<ClassifiedsResult<ConversationMessage[]>>
>();

export function invalidateConversationMessagesCache(conversationId?: string | null): void {
  const cleanConversationId = conversationId ? normalizeChatResourceId(conversationId) : null;
  if (cleanConversationId) {
    conversationMessageCache.delete(cleanConversationId);
    conversationMessageRequests.delete(cleanConversationId);
    return;
  }
  conversationMessageCache.clear();
  conversationMessageRequests.clear();
}

export async function fetchConversationMessages(
  conversationId: string,
): Promise<ClassifiedsResult<ConversationMessage[]>> {
  const cleanConversationId = normalizeChatResourceId(conversationId);
  if (!cleanConversationId) return fetchConversationMessagesBase(conversationId);

  const cached = conversationMessageCache.get(cleanConversationId);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const pending = conversationMessageRequests.get(cleanConversationId);
  if (pending) return pending;

  const request = fetchConversationMessagesBase(cleanConversationId)
    .then((result) => {
      if (result.ok) {
        conversationMessageCache.set(cleanConversationId, {
          expiresAt: Date.now() + CONVERSATION_MESSAGE_CACHE_TTL_MS,
          result,
        });
      }
      return result;
    })
    .finally(() => {
      if (conversationMessageRequests.get(cleanConversationId) === request) {
        conversationMessageRequests.delete(cleanConversationId);
      }
    });

  conversationMessageRequests.set(cleanConversationId, request);
  return request;
}

export async function sendConversationMessage(
  ...args: Parameters<typeof sendConversationMessageBase>
): ReturnType<typeof sendConversationMessageBase> {
  const result = await sendConversationMessageBase(...args);
  if (result.ok) invalidateConversationMessagesCache(args[0].conversationId);
  return result;
}

export {
  adminFetchMessageReports,
  adminModerateMessageReport,
  blockConversationParticipant,
  createChatAudioSignedUrl,
  createChatImageSignedUrl,
  downloadChatAudioObjectUrl,
  createMessageReport,
  fetchMyConversations,
  fromDbMessageReportStatus,
  markConversationRead,
  removeChatAudio,
  removeChatImage,
  startListingConversation,
  toDbMessageReportStatus,
  uploadChatAudio,
  uploadChatImage,
  validateChatAudio,
  validateChatImage,
};
