import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bookmark,
  CheckCheck,
  Heart,
  LoaderCircle,
  MessageCircle,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import {
  CommunicationCenterHero,
  CommunicationSectionHeader,
  CommunicationSignedOut,
} from "@/features/communication/CommunicationExperience";
import { NotificationPreferencesPanel } from "@/features/notifications/NotificationPreferencesPanel";
import { NotificationTimelineCard } from "@/features/notifications/NotificationTimelineCard";
import {
  fetchMyNotificationsPage,
  fetchMyNotificationById,
  fetchUnreadNotificationsCount,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationTarget,
} from "@/lib/classifieds-api";
import type { ClassifiedsError, NotificationItem } from "@/lib/classifieds-types";
import type { NotificationCursor } from "@/lib/classifieds-types";
import { getClient } from "@/lib/api/shared";
import {
  mergeNotifications,
  normalizeNotificationId,
  notificationIsWithinReadCutoff,
} from "@/lib/notification-integrity";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useUnreadActivityCounts } from "@/lib/unread-activity";
import { useAuth } from "@/lib/use-auth";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";

const notificationsSearchSchema = z.object({
  open: z.string().optional(),
});

export const Route = createFileRoute("/notifications")({
  validateSearch: notificationsSearchSchema,
  head: () => ({
    meta: [{ title: "التنبيهات | رواج" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: NotificationsPage,
});

const NOTIFICATIONS_PAGE_SIZE = 20;

function notificationActionScope(profileId: string, notificationId: string) {
  return [profileId, notificationId].join(":");
}

const followUpLinks = [
  { to: "/chats", labelAr: "الرسائل", labelEn: "Messages", icon: MessageCircle },
  { to: "/profile/listings", labelAr: "إعلاناتي", labelEn: "My listings", icon: ScrollText },
  { to: "/favorites", labelAr: "المفضلة", labelEn: "Favorites", icon: Heart },
  {
    to: "/saved-searches",
    labelAr: "عمليات البحث المحفوظة",
    labelEn: "Saved searches",
    icon: Bookmark,
  },
  { to: "/promotion", labelAr: "طلبات الترويج", labelEn: "Promotion requests", icon: Sparkles },
] as const;

function NotificationsPage() {
  const auth = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { language, text } = useUiPreferences();
  const { counts, refresh: refreshUnreadActivity } = useUnreadActivityCounts();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<NotificationCursor | null>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [unreadCountExact, setUnreadCountExact] = useState(true);
  const [loadError, setLoadError] = useState<ClassifiedsError | null>(null);
  const [paginationError, setPaginationError] = useState<ClassifiedsError | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [openingTargetIds, setOpeningTargetIds] = useState<Set<string>>(new Set());
  const [markingReadIds, setMarkingReadIds] = useState<Set<string>>(new Set());
  const [markingAll, setMarkingAll] = useState(false);
  const profileId = auth.profile?.id ?? null;
  const loadMoreInFlightRef = useRef(false);
  const notificationsRequestIdRef = useRef(0);
  const paginationRequestIdRef = useRef(0);
  const readNotificationIdsRef = useRef<Set<string>>(new Set());
  const markAllReadAtRef = useRef<string | null>(null);
  const loadedProfileIdRef = useRef<string | null>(null);
  const profileIdRef = useRef<string | null>(profileId);
  const markingReadScopesRef = useRef<Set<string>>(new Set());
  const openingTargetScopesRef = useRef<Set<string>>(new Set());
  const markingAllProfilesRef = useRef<Set<string>>(new Set());
  const handledPushOpenScopesRef = useRef<Set<string>>(new Set());
  const realtimeGenerationRef = useRef(0);
  const openNotificationTargetRef = useRef<(notification: NotificationItem) => Promise<void>>(
    async () => undefined,
  );
  profileIdRef.current = profileId;

  const applyKnownReadState = useCallback((items: NotificationItem[]) => {
    const markAllReadAt = markAllReadAtRef.current;
    const readIds = readNotificationIdsRef.current;
    return items.map((item) => {
      if (item.readAt) return item;
      if (markAllReadAt && notificationIsWithinReadCutoff(item, markAllReadAt)) {
        return { ...item, readAt: markAllReadAt };
      }
      if (readIds.has(item.id)) return { ...item, readAt: new Date().toISOString() };
      return item;
    });
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!profileId) return;
    const currentProfileId = profileId;
    const requestId = ++notificationsRequestIdRef.current;
    paginationRequestIdRef.current += 1;
    loadMoreInFlightRef.current = false;
    setLoading(true);
    setLoadingMore(false);
    setLoadError(null);
    setPaginationError(null);
    setActionMessage(null);

    try {
      const [pageResult, unreadResult] = await Promise.all([
        fetchMyNotificationsPage({ limit: NOTIFICATIONS_PAGE_SIZE }),
        fetchUnreadNotificationsCount(),
      ]);

      if (
        requestId !== notificationsRequestIdRef.current ||
        currentProfileId !== profileIdRef.current
      ) {
        return;
      }
      if (!pageResult.ok) {
        setLoadError(pageResult.error);
        setUnreadCountExact(false);
        return;
      }

      const nextItems = applyKnownReadState(pageResult.data.items);
      const loadedUnread = nextItems.filter((item) => !item.readAt).length;
      setNotifications(nextItems);
      setHasLoaded(true);
      setHasMore(pageResult.data.hasMore);
      setNextCursor(pageResult.data.nextCursor);
      setUnreadCountExact(unreadResult.ok);
      setUnreadTotal(
        unreadResult.ok
          ? unreadResult.data
          : Math.max(
              loadedUnread,
              counts.notifications,
              pageResult.data.hasMore && loadedUnread === 0 ? 1 : 0,
            ),
      );
      if (!unreadResult.ok) {
        setActionMessage(
          text(
            "تعذر تحديث العدد الدقيق للتنبيهات، لكن يمكنك متابعة العناصر وقراءتها بشكل طبيعي.",
            "The exact unread count could not be refreshed, but notifications remain usable.",
          ),
        );
      }
    } catch (caught) {
      if (
        requestId !== notificationsRequestIdRef.current ||
        currentProfileId !== profileIdRef.current
      ) {
        return;
      }
      setUnreadCountExact(false);
      setLoadError({
        code: "unknown",
        message:
          caught instanceof Error
            ? caught.message
            : text("تعذر تحميل التنبيهات.", "Could not load notifications."),
        operation: "notifications_load",
      });
    } finally {
      if (
        requestId === notificationsRequestIdRef.current &&
        currentProfileId === profileIdRef.current
      ) {
        setLoading(false);
      }
    }
  }, [applyKnownReadState, counts.notifications, profileId, text]);

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId) {
      notificationsRequestIdRef.current += 1;
      paginationRequestIdRef.current += 1;
      loadMoreInFlightRef.current = false;
      readNotificationIdsRef.current = new Set();
      markAllReadAtRef.current = null;
      loadedProfileIdRef.current = null;
      setNotifications([]);
      setLoading(false);
      setHasLoaded(false);
      setLoadingMore(false);
      setHasMore(false);
      setNextCursor(null);
      setUnreadTotal(0);
      setUnreadCountExact(true);
      setLoadError(null);
      setPaginationError(null);
      setActionMessage(null);
      setOpeningTargetIds(new Set());
      setMarkingReadIds(new Set());
      setMarkingAll(false);
      return;
    }

    if (loadedProfileIdRef.current !== profileId) {
      notificationsRequestIdRef.current += 1;
      paginationRequestIdRef.current += 1;
      loadMoreInFlightRef.current = false;
      readNotificationIdsRef.current = new Set();
      markAllReadAtRef.current = null;
      loadedProfileIdRef.current = profileId;
      setNotifications([]);
      setLoading(false);
      setHasLoaded(false);
      setLoadingMore(false);
      setHasMore(false);
      setNextCursor(null);
      setUnreadTotal(0);
      setUnreadCountExact(true);
      setLoadError(null);
      setPaginationError(null);
      setActionMessage(null);
      setOpeningTargetIds(new Set());
      setMarkingReadIds(new Set());
      setMarkingAll(false);
    }

    void loadNotifications();
    return () => {
      notificationsRequestIdRef.current += 1;
      paginationRequestIdRef.current += 1;
      loadMoreInFlightRef.current = false;
    };
  }, [auth.status, loadNotifications, profileId]);

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId || typeof window === "undefined") return;

    if (isCloudflarePublicDataProvider()) {
      const refreshWhenVisible = () => {
        if (document.visibilityState === "visible" && navigator.onLine !== false) {
          void refreshUnreadActivity();
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
    if (!clientResult.ok) return;

    const currentProfileId = profileId;
    const generation = ++realtimeGenerationRef.current;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const refreshUnread = () => {
      if (refreshTimer !== null) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(async () => {
        const result = await fetchUnreadNotificationsCount();
        if (
          generation !== realtimeGenerationRef.current ||
          currentProfileId !== profileIdRef.current
        )
          return;
        if (result.ok) {
          setUnreadTotal(result.data);
          setUnreadCountExact(true);
        }
        void refreshUnreadActivity();
      }, 150);
    };
    const channel = clientResult.data
      .channel(`rawaj-notifications:${currentProfileId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${currentProfileId}`,
        },
        async (payload) => {
          const record = payload.eventType === "DELETE" ? payload.old : payload.new;
          const notificationId = normalizeNotificationId(record?.id);
          if (!notificationId) return;
          if (payload.eventType === "DELETE") {
            setNotifications((current) => current.filter((item) => item.id !== notificationId));
            refreshUnread();
            return;
          }
          const result = await fetchMyNotificationById(notificationId);
          if (
            generation !== realtimeGenerationRef.current ||
            currentProfileId !== profileIdRef.current ||
            !result.ok ||
            !result.data
          )
            return;
          const notification = result.data;
          setNotifications((current) =>
            applyKnownReadState(mergeNotifications(current, [notification])),
          );
          refreshUnread();
        },
      )
      .subscribe();

    return () => {
      realtimeGenerationRef.current += 1;
      if (refreshTimer !== null) clearTimeout(refreshTimer);
      void clientResult.data.removeChannel(channel);
    };
  }, [applyKnownReadState, auth.status, profileId, refreshUnreadActivity]);

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId || !search.open) return;
    const notificationId = normalizeNotificationId(search.open);
    if (!notificationId) {
      void navigate({ to: "/notifications", search: {}, replace: true });
      return;
    }
    const scope = notificationActionScope(profileId, notificationId);
    if (handledPushOpenScopesRef.current.has(scope)) return;
    handledPushOpenScopesRef.current.add(scope);
    const currentProfileId = profileId;
    void (async () => {
      try {
        const result = await fetchMyNotificationById(notificationId);
        if (currentProfileId !== profileIdRef.current) return;
        void navigate({ to: "/notifications", search: {}, replace: true });
        if (!result.ok || !result.data) {
          setActionMessage(
            text(
              "تعذر فتح هذا التنبيه أو لم يعد متاحًا لهذا الحساب.",
              "This notification is unavailable for the current account.",
            ),
          );
          return;
        }
        setNotifications((current) =>
          applyKnownReadState(mergeNotifications(current, [result.data as NotificationItem])),
        );
        await openNotificationTargetRef.current(result.data as NotificationItem);
      } catch (caught) {
        if (currentProfileId !== profileIdRef.current) return;
        void navigate({ to: "/notifications", search: {}, replace: true });
        setActionMessage(
          caught instanceof Error
            ? caught.message
            : text("تعذر فتح التنبيه.", "Could not open the notification."),
        );
      }
    })();
  }, [applyKnownReadState, auth.status, navigate, profileId, search.open, text]);

  async function loadMoreNotifications() {
    if (
      !profileId ||
      loading ||
      loadingMore ||
      loadMoreInFlightRef.current ||
      !hasMore ||
      !nextCursor
    ) {
      return;
    }
    const currentProfileId = profileId;
    const parentRequestId = notificationsRequestIdRef.current;
    const paginationRequestId = ++paginationRequestIdRef.current;
    const cursorSnapshot = nextCursor;
    loadMoreInFlightRef.current = true;
    setLoadingMore(true);
    setPaginationError(null);

    try {
      const result = await fetchMyNotificationsPage({
        cursor: cursorSnapshot,
        limit: NOTIFICATIONS_PAGE_SIZE,
      });
      if (
        parentRequestId !== notificationsRequestIdRef.current ||
        paginationRequestId !== paginationRequestIdRef.current ||
        currentProfileId !== profileIdRef.current
      ) {
        return;
      }
      if (!result.ok) {
        setPaginationError(result.error);
        return;
      }
      const nextItems = applyKnownReadState(result.data.items);
      setNotifications((current) => mergeNotifications(current, nextItems));
      setHasMore(result.data.hasMore);
      setNextCursor(result.data.nextCursor);
    } catch (caught) {
      if (
        parentRequestId === notificationsRequestIdRef.current &&
        paginationRequestId === paginationRequestIdRef.current &&
        currentProfileId === profileIdRef.current
      ) {
        setPaginationError({
          code: "unknown",
          message:
            caught instanceof Error
              ? caught.message
              : text("تعذر تحميل المزيد من التنبيهات.", "Could not load more notifications."),
          operation: "notifications_load_more",
        });
      }
    } finally {
      if (paginationRequestId === paginationRequestIdRef.current) {
        loadMoreInFlightRef.current = false;
        setLoadingMore(false);
      }
    }
  }

  async function markOne(notificationId: string) {
    const currentProfileId = profileId;
    if (!currentProfileId) return false;
    const scopeKey = notificationActionScope(currentProfileId, notificationId);
    if (markingReadScopesRef.current.has(scopeKey)) return false;

    const wasUnread = notifications.some((item) => item.id === notificationId && !item.readAt);
    markingReadScopesRef.current.add(scopeKey);
    setMarkingReadIds((current) => new Set(current).add(notificationId));
    setActionMessage(null);
    try {
      const result = await markNotificationRead(notificationId);
      if (currentProfileId !== profileIdRef.current) return false;
      if (!result.ok) {
        setActionMessage(result.error.message);
        return false;
      }
      readNotificationIdsRef.current.add(notificationId);
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((item) => (item.id === notificationId ? { ...item, readAt } : item)),
      );
      if (wasUnread) setUnreadTotal((current) => Math.max(0, current - 1));
      void refreshUnreadActivity();
      return true;
    } catch (caught) {
      if (currentProfileId === profileIdRef.current) {
        setActionMessage(
          caught instanceof Error
            ? caught.message
            : text("تعذر تعليم التنبيه كمقروء.", "Could not mark the notification as read."),
        );
      }
      return false;
    } finally {
      markingReadScopesRef.current.delete(scopeKey);
      if (currentProfileId === profileIdRef.current) {
        setMarkingReadIds((current) => {
          const next = new Set(current);
          next.delete(notificationId);
          return next;
        });
      }
    }
  }

  async function markAll() {
    const currentProfileId = profileId;
    if (!currentProfileId || markingAllProfilesRef.current.has(currentProfileId)) return;

    markingAllProfilesRef.current.add(currentProfileId);
    setMarkingAll(true);
    setActionMessage(null);
    try {
      const result = await markAllNotificationsRead();
      if (currentProfileId !== profileIdRef.current) return;
      if (!result.ok) {
        setActionMessage(result.error.message);
        return;
      }
      const readAt = result.data.cutoff;
      markAllReadAtRef.current = readAt;
      notifications
        .filter((item) => notificationIsWithinReadCutoff(item, readAt))
        .forEach((item) => readNotificationIdsRef.current.add(item.id));
      setNotifications((current) =>
        current.map((item) =>
          notificationIsWithinReadCutoff(item, readAt) ? { ...item, readAt } : item,
        ),
      );
      setUnreadTotal(
        notifications.filter(
          (item) => !item.readAt && !notificationIsWithinReadCutoff(item, readAt),
        ).length,
      );
      setUnreadCountExact(true);
      void refreshUnreadActivity();
    } catch (caught) {
      if (currentProfileId === profileIdRef.current) {
        setActionMessage(
          caught instanceof Error
            ? caught.message
            : text(
                "تعذر تعليم جميع التنبيهات كمقروءة.",
                "Could not mark all notifications as read.",
              ),
        );
      }
    } finally {
      markingAllProfilesRef.current.delete(currentProfileId);
      if (currentProfileId === profileIdRef.current) setMarkingAll(false);
    }
  }

  async function openNotificationTarget(notification: NotificationItem) {
    const currentProfileId = profileId;
    if (!currentProfileId) return;
    const scopeKey = notificationActionScope(currentProfileId, notification.id);
    if (openingTargetScopesRef.current.has(scopeKey)) return;

    openingTargetScopesRef.current.add(scopeKey);
    setOpeningTargetIds((current) => new Set(current).add(notification.id));
    setActionMessage(null);
    try {
      const result = await resolveNotificationTarget(notification.id);
      if (currentProfileId !== profileIdRef.current) return;
      if (!result.ok) {
        setActionMessage(result.error.message);
        return;
      }
      const target = result.data;
      if (!target) {
        if (!notification.readAt) {
          await markOne(notification.id);
          if (currentProfileId !== profileIdRef.current) return;
        }
        setActionMessage(
          text(
            "لم يعد الهدف المرتبط بهذا التنبيه متاحًا.",
            "The item linked to this notification is no longer available.",
          ),
        );
        return;
      }
      if (!notification.readAt) {
        await markOne(notification.id);
        if (currentProfileId !== profileIdRef.current) return;
      }
      if (target.kind === "listing") {
        await navigate({ to: "/listings/$id", params: { id: target.listingId } });
      } else if (target.kind === "owner_listing") {
        await navigate({ to: "/profile/listings/$id", params: { id: target.listingId } });
      } else if (target.kind === "conversation") {
        await navigate({ to: "/chats", search: { conversation: target.conversationId } });
      } else if (target.kind === "seller") {
        await navigate({ to: "/seller/$id", params: { id: target.sellerId } });
      } else if (target.kind === "saved_search") {
        await navigate({
          to: "/saved-searches",
          search: {
            taxonomy: "",
            q: "",
            category: "",
            subcategory: "",
            gov: "",
            district: "",
            price_min: "",
            price_max: "",
            price_type: "",
            condition: "",
            car_make: "",
            car_model: "",
            fuel: "",
            transmission: "",
            property_purpose: "",
            property_type: "",
            rooms: "",
            rental_duration: "",
            electronics_brand: "",
            detail_condition: "",
            employment_type: "",
            salary_type: "",
            sort: "latest",
          },
        });
      } else if (target.kind === "browse_listings") {
        await navigate({ to: "/listings" });
      } else if (target.kind === "support") {
        await navigate({ to: "/support" });
      } else if (target.kind === "verification") {
        await navigate({ to: "/verification" });
      } else if (target.kind === "promotion") {
        await navigate({ to: "/promotion" });
      }
    } catch (caught) {
      if (currentProfileId === profileIdRef.current) {
        setActionMessage(
          caught instanceof Error
            ? caught.message
            : text("تعذر فتح هدف التنبيه.", "Could not open the notification target."),
        );
      }
    } finally {
      openingTargetScopesRef.current.delete(scopeKey);
      if (currentProfileId === profileIdRef.current) {
        setOpeningTargetIds((current) => {
          const next = new Set(current);
          next.delete(notification.id);
          return next;
        });
      }
    }
  }

  openNotificationTargetRef.current = openNotificationTarget;

  const hasUnreadEvidence =
    unreadTotal > 0 || notifications.some((item) => !item.readAt) || hasMore;

  return (
    <>
      <PageHeader title={text("التنبيهات", "Notifications")} to="/more" backMode="history" />
      <main className="rawaj-communication-v2 rawaj-communication-v2--notifications rawaj-account-activity-v3 container-wide rawaj-content-stack mobile-page-bottom pt-4">
        {auth.status !== "signedIn" ? (
          <CommunicationSignedOut returnTo="/notifications" />
        ) : (
          <section className="space-y-4">
            <CommunicationCenterHero
              mode="notifications"
              unreadMessages={counts.messages}
              unreadNotifications={unreadTotal}
              actions={
                <button
                  type="button"
                  disabled={!hasUnreadEvidence || markingAll}
                  onClick={() => void markAll()}
                  aria-busy={markingAll}
                >
                  {markingAll ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : (
                    <CheckCheck aria-hidden="true" />
                  )}
                  {markingAll
                    ? text("جارٍ التحديث", "Updating")
                    : text("قراءة الكل", "Mark all read")}
                </button>
              }
            />

            {actionMessage ? (
              <div
                role="status"
                className="rounded-xl bg-amber-500/10 p-3 text-center text-xs font-semibold text-foreground hairline"
              >
                {actionMessage}
                {!unreadCountExact ? (
                  <span className="ms-1 text-muted-foreground">
                    {text("العدد الظاهر تقريبي.", "Displayed count is approximate.")}
                  </span>
                ) : null}
              </div>
            ) : null}

            <section className="rawaj-notification-panel">
              <CommunicationSectionHeader
                eyebrow={text("السجل", "Timeline")}
                title={text("تنبيهات الحساب", "Account notifications")}
                description={text(
                  "التنبيهات الحقيقية المرتبطة بحسابك وإعلاناتك مرتبة من الأحدث.",
                  "Real notifications linked to your account and listings, ordered newest first.",
                )}
              />
              {loading && !hasLoaded ? (
                <Panel title={text("جارٍ تحميل التنبيهات", "Loading notifications")} />
              ) : loadError && !hasLoaded ? (
                <Panel
                  title={text("تعذر تحميل التنبيهات", "Could not load notifications")}
                  body={loadError.message}
                  actionLabel={text("إعادة المحاولة", "Try again")}
                  onAction={() => void loadNotifications()}
                  actionDisabled={loading}
                />
              ) : (
                <>
                  {loadError ? (
                    <RecoveryNotice
                      title={text("تعذر تحديث التنبيهات", "Could not refresh notifications")}
                      body={loadError.message}
                      actionLabel={text("إعادة المحاولة", "Try again")}
                      onAction={() => void loadNotifications()}
                      actionDisabled={loading}
                    />
                  ) : null}
                  {notifications.length === 0 ? (
                    <Panel
                      title={text("لا توجد تنبيهات حالياً", "No notifications right now")}
                      body={text(
                        "ستظهر هنا تنبيهات الحساب والإعلانات والرسائل عند توفرها.",
                        "Account, listing, and message notifications will appear here when available.",
                      )}
                    />
                  ) : (
                    <div className="rawaj-notification-list">
                      {notifications.map((notification) => {
                        const localized = localizedNotification(notification, language);
                        return (
                          <NotificationTimelineCard
                            key={notification.id}
                            notification={notification}
                            title={localized.title}
                            body={localized.body}
                            navigable={isNavigableNotification(notification)}
                            opening={openingTargetIds.has(notification.id)}
                            markingRead={markingReadIds.has(notification.id)}
                            onOpen={() => void openNotificationTarget(notification)}
                            onMarkRead={() => void markOne(notification.id)}
                            dateLabel={formatNotificationDate(notification.createdAt, language)}
                          />
                        );
                      })}
                      {paginationError ? (
                        <div className="rounded-xl bg-destructive/10 p-3 text-center text-xs font-semibold text-destructive">
                          {paginationError.message}
                        </div>
                      ) : null}
                      {hasMore ? (
                        <button
                          type="button"
                          disabled={loadingMore}
                          onClick={() => void loadMoreNotifications()}
                          className="w-full rounded-xl bg-muted-surface px-4 py-3 text-xs font-bold transition hover:bg-muted disabled:opacity-60 hairline"
                        >
                          {loadingMore
                            ? text("جارٍ تحميل المزيد...", "Loading more...")
                            : text("تحميل تنبيهات أقدم", "Load older notifications")}
                        </button>
                      ) : null}
                    </div>
                  )}
                </>
              )}
            </section>
          </section>
        )}

        <div className="rawaj-notification-preferences">
          <NotificationPreferencesPanel />
        </div>
        <section className="rawaj-communication-follow-up">
          <h2 className="text-sm font-extrabold">{text("متابعة سريعة", "Quick follow-up")}</h2>
          <div className="rawaj-communication-follow-up__grid">
            {followUpLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-3 rounded-xl bg-muted-surface p-3 text-sm font-bold transition hover:bg-muted hairline"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-card text-primary hairline">
                    <Icon className="h-4 w-4" />
                  </span>
                  {text(item.labelAr, item.labelEn)}
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}

function isNavigableNotification(notification: NotificationItem) {
  return Boolean(notification.targetId && notification.targetType);
}

function localizedNotification(notification: NotificationItem, language: "ar" | "en") {
  if (language === "ar") return { title: notification.titleAr, body: notification.bodyAr };
  const title = notification.titleEn || notification.titleAr;
  const body = notification.bodyEn || notification.bodyAr;
  return { title, body };
}

function Panel({
  title,
  body,
  actionLabel,
  onAction,
  actionDisabled,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
}) {
  return (
    <div className="mt-4 rounded-2xl bg-muted-surface p-5 text-center hairline">
      <p className="text-sm font-bold">{title}</p>
      {body ? <p className="mt-1 text-xs leading-6 text-muted-foreground">{body}</p> : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          className="mt-3 rounded-xl bg-card px-4 py-2 text-xs font-bold disabled:opacity-60 hairline"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function RecoveryNotice({
  title,
  body,
  actionLabel,
  onAction,
  actionDisabled,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
}) {
  return (
    <div className="mt-4 rounded-xl bg-destructive/10 p-4 text-destructive hairline">
      <p className="text-xs font-bold">{title}</p>
      <p className="mt-1 text-xs leading-5">{body}</p>
      <button
        type="button"
        onClick={onAction}
        disabled={actionDisabled}
        className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-card px-4 py-2 text-xs font-bold text-foreground disabled:opacity-60 hairline"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function formatNotificationDate(value: string, language: "ar" | "en") {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
