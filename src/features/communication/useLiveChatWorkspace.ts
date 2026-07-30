import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";

import "../../communication-center-v3.css";
import {
  fetchConversationMessages,
  invalidateConversationMessagesCache,
} from "@/lib/api/messaging-guarded";
import { fetchMyConversations, markConversationRead } from "@/lib/api/messaging";
import { normalizeChatResourceId } from "@/lib/chat-integrity";
import type { Conversation, ConversationMessage } from "@/lib/classifieds-types";
import { useUnreadActivityCounts } from "@/lib/unread-activity";

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

const INITIAL_DEEP_LINK_RESTORE_WINDOW_MS = 2_000;

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
  const navigate = useNavigate();
  const locationSearch = useRouterState({ select: (state) => state.location.search });
  const looseSearch = locationSearch as unknown as Record<string, unknown>;
  const routeConversationId = normalizeChatResourceId(
    typeof looseSearch.conversation === "string" ? looseSearch.conversation : null,
  );
  const activeScopeRef = useRef<string | null>(null);
  const inFlightRefreshRef = useRef<InFlightChatRefresh | null>(null);
  const previousUnreadMessagesRef = useRef<number | null>(null);
  const cacheProfileIdRef = useRef<string | null | undefined>(undefined);
  const profileTransitionRef = useRef<string | null>(signedIn ? profileId : null);
  const initialDeepLinkRef = useRef<string | null>(routeConversationId);
  const restoreDeadlineRef = useRef(0);

  if (routeConversationId) initialDeepLinkRef.current = routeConversationId;

  useEffect(() => {
    const nextProfileId = signedIn ? profileId : null;
    const previousProfileId = profileTransitionRef.current;
    profileTransitionRef.current = nextProfileId;

    if (previousProfileId && previousProfileId !== nextProfileId) {
      initialDeepLinkRef.current = null;
      restoreDeadlineRef.current = 0;
      return;
    }

    if (!previousProfileId && nextProfileId && initialDeepLinkRef.current) {
      restoreDeadlineRef.current = Date.now() + INITIAL_DEEP_LINK_RESTORE_WINDOW_MS;
      const timeout = window.setTimeout(() => {
        restoreDeadlineRef.current = 0;
      }, INITIAL_DEEP_LINK_RESTORE_WINDOW_MS);
      return () => window.clearTimeout(timeout);
    }
  }, [profileId, signedIn]);

  useEffect(() => {
    const rememberedConversationId = initialDeepLinkRef.current;
    if (
      !signedIn ||
      !profileId ||
      routeConversationId ||
      !rememberedConversationId ||
      restoreDeadlineRef.current < Date.now()
    ) {
      return;
    }

    restoreDeadlineRef.current = 0;
    void navigate({
      to: "/chats",
      search: { conversation: rememberedConversationId },
      replace: true,
    });
  }, [navigate, profileId, routeConversationId, signedIn]);

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
  }, [profileId, refreshWorkspace, selectedConversationId, signedIn]);
}
