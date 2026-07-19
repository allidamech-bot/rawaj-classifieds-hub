import type { Conversation } from "@/lib/classifieds-types";

export type ConversationTargetResolution =
  | { kind: "selected"; conversation: Conversation }
  | { kind: "missing"; requestedConversationId: string }
  | { kind: "default"; conversation: Conversation }
  | { kind: "empty" };

export function resolveConversationTarget(
  conversations: Conversation[],
  requestedConversationId?: string,
): ConversationTargetResolution {
  const requestedId = requestedConversationId?.trim();
  if (requestedId) {
    const selected = conversations.find((conversation) => conversation.id === requestedId);
    if (selected) return { kind: "selected", conversation: selected };
    return { kind: "missing", requestedConversationId: requestedId };
  }

  // Generic navigation to /chats must remain list-first. A conversation is only
  // selected when the route contains an explicit, validated conversation id.
  return { kind: "empty" };
}

export type JourneyTargetKind = "listing" | "conversation" | "seller";

export interface JourneyTarget {
  kind: JourneyTargetKind;
  id: string;
}

export type JourneyTargetFallback =
  { kind: "browse_listings" } | { kind: "open_messages" } | { kind: "open_profile" };

export function fallbackForMissingJourneyTarget(target: JourneyTarget): JourneyTargetFallback {
  switch (target.kind) {
    case "listing":
      return { kind: "browse_listings" };
    case "conversation":
      return { kind: "open_messages" };
    case "seller":
      return { kind: "open_profile" };
  }
}
