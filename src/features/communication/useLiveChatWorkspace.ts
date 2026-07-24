import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";

import "../../communication-center-v3.css";
import {
  fetchConversationMessages,
  invalidateConversationMessagesCache,
} from "@/lib/api/messaging-guarded";
import { fetchMyConversations, markConversationRead } from "@/lib/api/messaging";
import { getClient } from "@/lib/api/shared";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";
import type { Conversation, ConversationMessage } from "@/lib/classifieds-types";
import { useUnreadActivityCounts } from "@/lib/unread-activity";

const LIVE_CHAT_EVENT_DEBOUNCE_MS = 150;

interface LiveChatWorkspaceOptions {
  signedIn: boolean;
  profileId: string | null;
  selectedConversationId: string | null;
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  setMessages: Dispatch<SetStateAction<ConversationMessage[]>>;
}

interface InFlightChatRefresh {
  scopeKey: string;
  promise: Promise<void>;
}

function buildScopeKey(profileId: string, conversationId: string | null) {
  return `${profileId}:${conversationId ?? "conversation-list"}`;
}

export function useLiveChatWorkspace({
  signedIn,
  profileId,
  selectedConversationId,
  setConversations,
  setMessages,
}: LiveChatWorkspaceOptions) {
  const { counts } = useUnreadActivityCounts();
  const activeScopeRef = useRef<string | null>(null);
  const inFlightRefreshRef = useRef<InFlightChatRefresh | null>(null);
  const previousUnreadMessagesRef = useRef<number | null>(null);
  const cacheProfileIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const nextProfileId = signedIn ? profileId : null;
    if (cacheProfileIdRef.current === nextProfileId) return;

    cacheProfileIdRef.current = nextProfileId;
    invalidateConversationMessagesCache();
    inFlightRefreshRef.current = null;
    previousUnreadMessagesRef.current = null;
  }, [profileId, signedIn]);

  useEffect(() => {
    const scopeKey =
      signedIn && profileId ? buildScopeKey(profileId, selectedConversationId) : null;
    activeScopeRef.current = scopeKey;

    return () => {
      if (activeScopeRef.current === scopeKey) activeScopeRef.current = null;
    };
  }, [profileId, selectedConversationId, signedIn]);

  const refreshWorkspace = useCallback(async () => {
    if (!signedIn || !profileId) return;

    const conversationId = selectedConversationId;
    const scopeKey = buildScopeKey(profileId, conversationId);
    const activeRefresh = inFlightRefreshRef.current;
    if (activeRefresh?.scopeKey === scopeKey) return activeRefresh.promise;

    const request = (async () => {
      const [conversationsResult, messagesResult] = await Promise.all([
        fetchMyConversations(),
        conversationId ? fetchConversationMessages(conversationId) : Promise.resolve(null),
      ]);

      if (activeScopeRef.current !== scopeKey) return;

      const refreshedConversation =
        conversationsResult.ok && conversationId
          ? (conversationsResult.data.find((conversation) => conversation.id === conversationId) ??
            null)
          : null;

      if (conversationsResult.ok) {
        setConversations(conversationsResult.data);
      }

      if (!conversationId || !messagesResult?.ok) return;

      setMessages(messagesResult.data);
      if (!refreshedConversation || refreshedConversation.unreadCount <= 0) return;

      const readResult = await markConversationRead(conversationId);
      if (!readResult.ok || activeScopeRef.current !== scopeKey) return;

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId && conversation.unreadCount !== 0
            ? { ...conversation, unreadCount: 0 }
            : conversation,
        ),
      );
    })().finally(() => {
      if (inFlightRefreshRef.current?.promise === request) {
        inFlightRefreshRef.current = null;
      }
    });

    inFlightRefreshRef.current = { scopeKey, promise: request };
    return request;
  }, [profileId, selectedConversationId, setConversations, setMessages, signedIn]);

  useEffect(() => {
    if (!signedIn || !profileId) {
      previousUnreadMessagesRef.current = null;
      return;
    }

    const previousUnreadMessages = previousUnreadMessagesRef.current;
    previousUnreadMessagesRef.current = counts.messages;
    if (previousUnreadMessages === null || previousUnreadMessages === counts.messages) return;

    invalidateConversationMessagesCache(selectedConversationId);
    void refreshWorkspace();
  }, [counts.messages, profileId, refreshWorkspace, selectedConversationId, signedIn]);

  useEffect(() => {
    if (!signedIn || !profileId || typeof window === "undefined") return;

    if (isCloudflarePublicDataProvider()) {
      const refreshWhenVisible = () => {
        if (document.visibilityState === "visible" && navigator.onLine !== false) {
          invalidateConversationMessagesCache(selectedConversationId);
          void refreshWorkspace();
        }
      };
      const interval = window.setInterval(refreshWhenVisible, 15_000);
      document.addEventListener("visibilitychange", refreshWhenVisible);
      window.addEventListener("online", refreshWhenVisible);
      window.addEventListener("focus", refreshWhenVisible);
      return () => {
        window.clearInterval(interval);
        document.removeEventListener("visibilitychange", refreshWhenVisible);
        window.removeEventListener("online", refreshWhenVisible);
        window.removeEventListener("focus", refreshWhenVisible);
      };
    }

    const clientResult = getClient();
    const scopeKey = buildScopeKey(profileId, selectedConversationId);
    let realtimeTimer: ReturnType<typeof setTimeout> | null = null;

    const refreshWhenAvailable = () => {
      if (document.visibilityState === "hidden" || navigator.onLine === false) return;
      invalidateConversationMessagesCache(selectedConversationId);
      void refreshWorkspace();
    };

    const scheduleRealtimeRefresh = (payload?: { new?: unknown; old?: unknown }) => {
      if (activeScopeRef.current !== scopeKey) return;
      const row =
        payload?.new && typeof payload.new === "object"
          ? (payload.new as Record<string, unknown>)
          : payload?.old && typeof payload.old === "object"
            ? (payload.old as Record<string, unknown>)
            : null;
      if (
        row &&
        selectedConversationId &&
        typeof row.conversation_id === "string" &&
        row.conversation_id !== selectedConversationId
      )
        return;
      if (document.visibilityState === "hidden" || navigator.onLine === false) return;
      if (realtimeTimer !== null) clearTimeout(realtimeTimer);
      invalidateConversationMessagesCache(selectedConversationId);
      realtimeTimer = setTimeout(refreshWhenAvailable, LIVE_CHAT_EVENT_DEBOUNCE_MS);
    };

    window.addEventListener("online", refreshWhenAvailable);
    window.addEventListener("focus", refreshWhenAvailable);
    document.addEventListener("visibilitychange", refreshWhenAvailable);

    const channel =
      clientResult.ok && selectedConversationId
        ? clientResult.data
            .channel(`rawaj-live-chat:${profileId}:${selectedConversationId}`)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "conversation_messages",
                filter: `conversation_id=eq.${selectedConversationId}`,
              },
              scheduleRealtimeRefresh,
            )
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "conversations",
                filter: `id=eq.${selectedConversationId}`,
              },
              scheduleRealtimeRefresh,
            )
            .subscribe()
        : null;

    return () => {
      if (realtimeTimer !== null) clearTimeout(realtimeTimer);
      window.removeEventListener("online", refreshWhenAvailable);
      window.removeEventListener("focus", refreshWhenAvailable);
      document.removeEventListener("visibilitychange", refreshWhenAvailable);
      if (channel && clientResult.ok) void clientResult.data.removeChannel(channel);
    };
  }, [profileId, refreshWorkspace, selectedConversationId, signedIn]);
}
