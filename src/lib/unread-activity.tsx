import { useRouterState } from "@tanstack/react-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchMyConversations } from "@/lib/api/messaging";
import { fetchUnreadNotificationsCount } from "@/lib/api/notifications";
import { UNREAD_ACTIVITY_CHANGED_EVENT } from "@/lib/unread-activity-events";
import { useAuth } from "@/lib/use-auth";

export interface UnreadActivityCounts {
  messages: number;
  notifications: number;
  total: number;
}

interface UnreadActivityContextValue {
  counts: UnreadActivityCounts;
  loading: boolean;
  refresh: () => Promise<void>;
}

const EMPTY_COUNTS: UnreadActivityCounts = {
  messages: 0,
  notifications: 0,
  total: 0,
};

const UnreadActivityContext = createContext<UnreadActivityContextValue>({
  counts: EMPTY_COUNTS,
  loading: false,
  refresh: async () => undefined,
});

export function UnreadActivityProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [counts, setCounts] = useState<UnreadActivityCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(false);
  const profileId = auth.profile?.id ?? null;

  const refresh = useCallback(async () => {
    if (auth.status !== "signedIn" || !profileId) {
      setCounts(EMPTY_COUNTS);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [conversationsResult, notificationsResult] = await Promise.all([
      fetchMyConversations(profileId),
      fetchUnreadNotificationsCount(profileId),
    ]);

    const messages = conversationsResult.ok
      ? conversationsResult.data.reduce((sum, conversation) => sum + Math.max(0, conversation.unreadCount), 0)
      : 0;
    const notifications = notificationsResult.ok ? Math.max(0, notificationsResult.data) : 0;

    setCounts({
      messages,
      notifications,
      total: messages + notifications,
    });
    setLoading(false);
  }, [auth.status, profileId]);

  useEffect(() => {
    void refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleRefresh = () => void refresh();
    window.addEventListener(UNREAD_ACTIVITY_CHANGED_EVENT, handleRefresh);
    window.addEventListener("focus", handleRefresh);
    return () => {
      window.removeEventListener(UNREAD_ACTIVITY_CHANGED_EVENT, handleRefresh);
      window.removeEventListener("focus", handleRefresh);
    };
  }, [refresh]);

  const value = useMemo(() => ({ counts, loading, refresh }), [counts, loading, refresh]);
  return <UnreadActivityContext.Provider value={value}>{children}</UnreadActivityContext.Provider>;
}

export function useUnreadActivityCounts() {
  return useContext(UnreadActivityContext);
}
