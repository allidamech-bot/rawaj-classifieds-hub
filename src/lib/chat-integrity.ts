import type { Conversation, ConversationMessage } from "@/lib/classifieds-types";

export const CHAT_MESSAGE_MAX_LENGTH = 2000;
export const CHAT_HISTORY_PAGE_SIZE = 200;

export const CHAT_RESOURCE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeChatResourceId(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return CHAT_RESOURCE_ID_PATTERN.test(normalized) ? normalized : null;
}

export function sortAndDedupeConversations(rows: Conversation[]) {
  const byId = new Map<string, Conversation>();
  for (const row of rows) {
    if (row.id) byId.set(row.id, row);
  }
  return [...byId.values()].sort((left, right) => {
    const leftActivity = left.lastMessageAt ?? left.updatedAt ?? left.createdAt;
    const rightActivity = right.lastMessageAt ?? right.updatedAt ?? right.createdAt;
    return rightActivity.localeCompare(leftActivity) || right.id.localeCompare(left.id);
  });
}

export function sortAndDedupeMessages(rows: ConversationMessage[], conversationId: string) {
  const byId = new Map<string, ConversationMessage>();
  for (const row of rows) {
    if (row.id && row.conversationId === conversationId) byId.set(row.id, row);
  }
  return [...byId.values()].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
  );
}

export function mergeConversationMessages(
  current: ConversationMessage[],
  incoming: ConversationMessage[],
  conversationId: string,
) {
  return sortAndDedupeMessages([...current, ...incoming], conversationId);
}
