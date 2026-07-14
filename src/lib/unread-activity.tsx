import { useRouterState } from "@tanstack/react-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { fetchMyConversations } from "@/lib/api/messaging";
import { fetchUnreadNotificationsCount } from "@/lib/api/notifications";
import { getClient } from "@/lib/api/shared";
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

interface InFlightUnreadRefresh {
  profileId: string;
  promise: Promise<void>;
}

const EMPTY_COUNTS: UnreadActivityCounts = {
  messages: 0,
  notifications: 0,
  total: 0,
};

const UNREAD_ACTIVITY_POLL_MS = 60 * 1000;
const UNREAD_ACTIVITY_EVENT_DEBOUNCE_MS = 250;

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
  const activeProfileRef = useRef<string | null>(null);
  const refreshInFlightRef = useRef<InFlightUnreadRefresh | null>(null);

  useEffect(() => {
    activeProfileRef.current = auth.status === "signedIn" ? profileId : null;
  }, [auth.status, profileId]);

  const refresh = useCallback(async () => {
    if (auth.status !== "signedIn" || !profileId) {
      setCounts(EMPTY_COUNTS);
      setLoading(false);
      return;
    }

    const activeRefresh = refreshInFlightRef.current;
    if (activeRefresh?.profileId === profileId) return activeRefresh.promise;

    const refreshRecord: InFlightUnreadRefresh = {
      profileId,
      promise: Promise.resolve(),
    };
    const request = (async () => {
      setLoading(true);
      try {
        const [conversationsResult, notificationsResult] = await Promise.all([
          fetchMyConversations(profileId),
          fetchUnreadNotificationsCount(profileId),
        ]);

        if (activeProfileRef.current !== profileId) return;

        const messages = conversationsResult.ok
          ? conversationsResult.data.reduce(
              (sum, conversation) => sum + Math.max(0, conversation.unreadCount),
              0,
            )
          : 0;
        const notifications = notificationsResult.ok ? Math.max(0, notificationsResult.data) : 0;

        setCounts({
          messages,
          notifications,
          total: messages + notifications,
        });
      } finally {
        if (activeProfileRef.current === profileId) setLoading(false);
      }
    })().finally(() => {
      if (refreshInFlightRef.current === refreshRecord) refreshInFlightRef.current = null;
    });

    refreshRecord.promise = request;
    refreshInFlightRef.current = refreshRecord;
    return request;
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

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId || typeof window === "undefined") return;

    const clientResult = getClient();
    if (!clientResult.ok) return;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (document.visibilityState === "hidden") return;
      if (refreshTimer !== null) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void refresh(), UNREAD_ACTIVITY_EVENT_DEBOUNCE_MS);
    };

    const channel = clientResult.data
      .channel(`rawaj-unread-activity:${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${profileId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (refreshTimer !== null) clearTimeout(refreshTimer);
      void clientResult.data.removeChannel(channel);
    };
  }, [auth.status, profileId, refresh]);

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId || typeof window === "undefined") return;

    const refreshWhenAvailable = () => {
      if (document.visibilityState === "hidden" || navigator.onLine === false) return;
      void refresh();
    };
    const interval = window.setInterval(refreshWhenAvailable, UNREAD_ACTIVITY_POLL_MS);

    window.addEventListener("online", refreshWhenAvailable);
    document.addEventListener("visibilitychange", refreshWhenAvailable);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", refreshWhenAvailable);
      document.removeEventListener("visibilitychange", refreshWhenAvailable);
    };
  }, [auth.status, profileId, refresh]);

  const value = useMemo(() => ({ counts, loading, refresh }), [counts, loading, refresh]);
  return <UnreadActivityContext.Provider value={value}>{children}</UnreadActivityContext.Provider>;
}

export function useUnreadActivityCounts() {
  return useContext(UnreadActivityContext);
}
