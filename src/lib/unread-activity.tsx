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
import {
  fetchUnreadNotificationsCount,
  getRecentUnreadNotificationsCount,
} from "@/lib/api/notifications";
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
const UNREAD_POLL_INTERVAL_MS = 60_000;

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
  const countsProfileIdRef = useRef<string | null>(null);
  const refreshInFlightRef = useRef<InFlightUnreadRefresh | null>(null);

  useEffect(() => {
    activeProfileRef.current = auth.status === "signedIn" ? profileId : null;
  }, [auth.status, profileId]);

  const refreshFull = useCallback(async () => {
    if (auth.status !== "signedIn" || !profileId) {
      countsProfileIdRef.current = null;
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

        setCounts((current) => {
          const currentForProfile =
            countsProfileIdRef.current === profileId ? current : EMPTY_COUNTS;
          const messages = conversationsResult.ok
            ? conversationsResult.data.reduce(
                (sum, conversation) => sum + Math.max(0, conversation.unreadCount),
                0,
              )
            : currentForProfile.messages;
          const notifications = notificationsResult.ok
            ? Math.max(0, notificationsResult.data)
            : currentForProfile.notifications;

          return {
            messages,
            notifications,
            total: messages + notifications,
          };
        });
        countsProfileIdRef.current = profileId;
        setCountsProfileId(profileId);
      } catch {
        // Keep the last known counters on transient/unexpected network failures.
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

  const refresh = useCallback(async () => {
    if (auth.status !== "signedIn" || !profileId) {
      return refreshFull();
    }

    const recentNotifications = getRecentUnreadNotificationsCount();
    if (countsProfileIdRef.current === profileId && recentNotifications !== null) {
      setCounts((current) => ({
        messages: current.messages,
        notifications: recentNotifications,
        total: current.messages + recentNotifications,
      }));
      return;
    }

    return refreshFull();
  }, [auth.status, profileId, refreshFull]);

  useEffect(() => {
    void refreshFull();
  }, [refreshFull]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleRefresh = () => void refreshFull();
    window.addEventListener(UNREAD_ACTIVITY_CHANGED_EVENT, handleRefresh);
    window.addEventListener("focus", handleRefresh);
    window.addEventListener("online", handleRefresh);
    return () => {
      window.removeEventListener(UNREAD_ACTIVITY_CHANGED_EVENT, handleRefresh);
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener("online", handleRefresh);
    };
  }, [refreshFull]);

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId || typeof window === "undefined") return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine !== false) {
        void refreshFull();
      }
    };
    const interval = window.setInterval(refreshWhenVisible, UNREAD_POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [auth.status, profileId, refreshFull]);

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
