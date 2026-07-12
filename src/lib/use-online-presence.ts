import { useEffect, useRef, useState } from "react";
import type { ConversationMessage } from "@/lib/classifieds-types";
import { supabase } from "@/lib/supabase";

interface PresencePayload {
  user_id?: string;
  online_at?: string;
}

export function useOnlinePresence(userId: string | null | undefined, enabled: boolean) {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(() => new Set<string>());

  useEffect(() => {
    const client = supabase;
    if (!client || !enabled || !userId) {
      setOnlineUserIds(new Set<string>());
      return;
    }

    const channel = client.channel("rawaj-presence-v1", {
      config: { presence: { key: userId } },
    });

    const syncPresence = () => {
      const state = channel.presenceState() as unknown as Record<string, PresencePayload[]>;
      const next = new Set<string>();
      for (const entries of Object.values(state)) {
        for (const entry of entries) {
          if (entry.user_id) next.add(entry.user_id);
        }
      }
      setOnlineUserIds(next);
    };

    channel
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence)
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && document.visibilityState === "visible") {
          void channel.track({ user_id: userId, online_at: new Date().toISOString() });
        }
      });

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void channel.track({ user_id: userId, online_at: new Date().toISOString() });
      } else {
        void channel.untrack();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      void channel.untrack();
      void client.removeChannel(channel);
    };
  }, [enabled, userId]);

  return { onlineUserIds };
}

export function useConversationMessagesRealtime({
  conversationId,
  enabled,
  onMessage,
}: {
  conversationId: string | null;
  enabled: boolean;
  onMessage: (message: ConversationMessage) => void;
}) {
  const callbackRef = useRef(onMessage);

  useEffect(() => {
    callbackRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const client = supabase;
    if (!client || !enabled || !conversationId) return;

    const channel = client
      .channel(`rawaj-conversation-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const id = typeof row.id === "string" ? row.id : "";
          const rowConversationId =
            typeof row.conversation_id === "string" ? row.conversation_id : "";
          const senderUserId = typeof row.sender_user_id === "string" ? row.sender_user_id : "";
          const body = typeof row.body === "string" ? row.body : "";
          const createdAt = typeof row.created_at === "string" ? row.created_at : "";
          if (!id || rowConversationId !== conversationId || !senderUserId || !createdAt) return;

          callbackRef.current({
            id,
            conversationId: rowConversationId,
            senderUserId,
            body,
            createdAt,
            editedAt: typeof row.edited_at === "string" ? row.edited_at : null,
            deletedAt: typeof row.deleted_at === "string" ? row.deleted_at : null,
          });
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [conversationId, enabled]);
}
