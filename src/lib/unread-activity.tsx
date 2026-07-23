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
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";

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

const UNREAD_ACTIVITY_EVENT_DEBOUNCE_MS = 250;

const UnreadActivityContext = createContext<UnreadActivityContextValue>({
  counts: EMPTY_COUNTS,
  loading: false,
  refresh: async () => undefined,
});

export function UnreadActivityProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [counts, setCounts] = useState<UnreadActivityCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(false);
  const [countsProfileId, setCountsProfileId] = useState<string | null>(null);
  const profileId = auth.profile?.id ?? null;
  const activeProfileRef = useRef<string | null>(null);
  const refreshInFlightRef = useRef<InFlightUnreadRefresh | null>(null);

  useEffect(() => {
    activeProfileRef.current = auth.status === "signedIn" ? profileId : null;
  }, [auth.status, profileId]);

  const refresh = useCallback(async () => {
    if (auth.status !== "signedIn" || !profileId) {
      setCounts(EMPTY_COUNTS);
      setCountsProfileId(null);
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
          fetchMyConversations(),
          fetchUnreadNotificationsCount(),
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
        setCountsProfileId(profileId);
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
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleRefresh = () => void refresh();
    window.addEventListener(UNREAD_ACTIVITY_CHANGED_EVENT, handleRefresh);
    window.addEventListener("focus", handleRefresh);
    window.addEventListener("online", handleRefresh);
    return () => {
      window.removeEventListener(UNREAD_ACTIVITY_CHANGED_EVENT, handleRefresh);
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener("online", handleRefresh);
    };
  }, [refresh]);

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId || typeof window === "undefined") return;

    if (isCloudflarePublicDataProvider()) {
      const refreshWhenVisible = () => {
        if (document.visibilityState === "visible" && navigator.onLine !== false) {
          void refresh();
        }
      };
      const interval = window.setInterval(refreshWhenVisible, 30_000);
      document.addEventListener("visibilitychange", refreshWhenVisible);
      return () => {
        window.clearInterval(interval);
        document.removeEventListener("visibilitychange", refreshWhenVisible);
      };
    }

    const clientResult = getClient();
    if (!clientResult.ok) return;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (document.visibilityState === "hidden" || navigator.onLine === false) return;
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
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (refreshTimer !== null) clearTimeout(refreshTimer);
      void clientResult.data.removeChannel(channel);
    };
  }, [auth.status, profileId, refresh]);

  const visibleCounts =
    auth.status === "signedIn" && profileId && countsProfileId === profileId
      ? counts
      : EMPTY_COUNTS;
  const value = useMemo(
    () => ({ counts: visibleCounts, loading, refresh }),
    [loading, refresh, visibleCounts],
  );
  return <UnreadActivityContext.Provider value={value}>{children}</UnreadActivityContext.Provider>;
}

export function useUnreadActivityCounts() {
  return useContext(UnreadActivityContext);
}
