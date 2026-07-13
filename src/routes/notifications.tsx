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
  fetchUnreadNotificationsCount,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationTarget,
} from "@/lib/classifieds-api";
import type { ClassifiedsError, NotificationItem } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useUnreadActivityCounts } from "@/lib/unread-activity";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [{ title: "التنبيهات | رواج" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: NotificationsPage,
});

const NOTIFICATIONS_PAGE_SIZE = 20;

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
  const navigate = useNavigate();
  const { language, text } = useUiPreferences();
  const { counts, refresh: refreshUnreadActivity } = useUnreadActivityCounts();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
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

  const applyKnownReadState = useCallback((items: NotificationItem[]) => {
    const markAllReadAt = markAllReadAtRef.current;
    const readIds = readNotificationIdsRef.current;
    return items.map((item) => {
      if (item.readAt) return item;
      if (markAllReadAt) return { ...item, readAt: markAllReadAt };
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

    const [pageResult, unreadResult] = await Promise.all([
      fetchMyNotificationsPage(currentProfileId, 0, NOTIFICATIONS_PAGE_SIZE),
      fetchUnreadNotificationsCount(currentProfileId),
    ]);

    if (requestId !== notificationsRequestIdRef.current || currentProfileId !== profileId) return;

    if (!pageResult.ok) {
      setLoadError(pageResult.error);
      setNotifications([]);
      setHasMore(false);
      setUnreadTotal(0);
      setUnreadCountExact(false);
      setLoading(false);
      return;
    }

    const nextItems = applyKnownReadState(pageResult.data.items);
    const loadedUnread = nextItems.filter((item) => !item.readAt).length;
    setNotifications(nextItems);
    setHasMore(pageResult.data.hasMore);
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
    setLoading(false);
  }, [applyKnownReadState, counts.notifications, profileId, text]);

  useEffect(() => {
    if (auth.status !== "signedIn") {
      notificationsRequestIdRef.current += 1;
      paginationRequestIdRef.current += 1;
      loadMoreInFlightRef.current = false;
      readNotificationIdsRef.current = new Set();
      markAllReadAtRef.current = null;
      setNotifications([]);
      setLoading(false);
      setLoadingMore(false);
      setHasMore(false);
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
    void loadNotifications();
  }, [auth.status, loadNotifications]);

  async function loadMoreNotifications() {
    if (!profileId || loading || loadingMore || loadMoreInFlightRef.current || !hasMore) return;
    const currentProfileId = profileId;
    const parentRequestId = notificationsRequestIdRef.current;
    const paginationRequestId = ++paginationRequestIdRef.current;
    const offset = notifications.length;
    loadMoreInFlightRef.current = true;
    setLoadingMore(true);
    setPaginationError(null);

    try {
      const result = await fetchMyNotificationsPage(
        currentProfileId,
        offset,
        NOTIFICATIONS_PAGE_SIZE,
      );
      if (
        parentRequestId !== notificationsRequestIdRef.current ||
        paginationRequestId !== paginationRequestIdRef.current ||
        currentProfileId !== auth.profile?.id
      )
        return;
      if (!result.ok) {
        setPaginationError(result.error);
        return;
      }
      const nextItems = applyKnownReadState(result.data.items);
      setNotifications((current) => {
        const knownIds = new Set(current.map((item) => item.id));
        return [...current, ...nextItems.filter((item) => !knownIds.has(item.id))];
      });
      setHasMore(result.data.hasMore);
    } finally {
      if (paginationRequestId === paginationRequestIdRef.current) {
        loadMoreInFlightRef.current = false;
        setLoadingMore(false);
      }
    }
  }

  async function markOne(notificationId: string) {
    if (!profileId || markingReadIds.has(notificationId)) return false;
    const currentProfileId = profileId;
    const wasUnread = notifications.some((item) => item.id === notificationId && !item.readAt);
    setMarkingReadIds((current) => new Set(current).add(notificationId));
    setActionMessage(null);
    try {
      const result = await markNotificationRead(currentProfileId, notificationId);
      if (currentProfileId !== auth.profile?.id) return false;
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
    } finally {
      setMarkingReadIds((current) => {
        const next = new Set(current);
        next.delete(notificationId);
        return next;
      });
    }
  }

  async function markAll() {
    if (!profileId || markingAll) return;
    const currentProfileId = profileId;
    setMarkingAll(true);
    setActionMessage(null);
    try {
      const result = await markAllNotificationsRead(currentProfileId);
      if (currentProfileId !== auth.profile?.id) return;
      if (!result.ok) {
        setActionMessage(result.error.message);
        return;
      }
      const readAt = new Date().toISOString();
      markAllReadAtRef.current = readAt;
      notifications.forEach((item) => readNotificationIdsRef.current.add(item.id));
      setNotifications((current) => current.map((item) => ({ ...item, readAt })));
      setUnreadTotal(0);
      setUnreadCountExact(true);
      void refreshUnreadActivity();
    } finally {
      setMarkingAll(false);
    }
  }

  async function openNotificationTarget(notification: NotificationItem) {
    if (!profileId || openingTargetIds.has(notification.id)) return;
    setOpeningTargetIds((current) => new Set(current).add(notification.id));
    setActionMessage(null);
    try {
      const result = await resolveNotificationTarget(profileId, notification);
      if (!result.ok) {
        setActionMessage(result.error.message);
        return;
      }
      const target = result.data;
      if (!target) {
        if (!notification.readAt) await markOne(notification.id);
        setActionMessage(
          text(
            "لم يعد الهدف المرتبط بهذا التنبيه متاحًا.",
            "The item linked to this notification is no longer available.",
          ),
        );
        return;
      }
      if (!notification.readAt) await markOne(notification.id);
      if (target.kind === "listing") {
        void navigate({ to: "/listings/$id", params: { id: target.listingId } });
      } else if (target.kind === "conversation" || target.kind === "conversation_missing") {
        void navigate({ to: "/chats", search: { conversation: target.conversationId } });
      } else if (target.kind === "seller") {
        void navigate({ to: "/seller/$id", params: { id: target.sellerId } });
      } else if (target.kind === "browse_listings") {
        void navigate({ to: "/listings" });
      }
    } finally {
      setOpeningTargetIds((current) => {
        const next = new Set(current);
        next.delete(notification.id);
        return next;
      });
    }
  }

  const hasUnreadEvidence =
    unreadTotal > 0 || notifications.some((item) => !item.readAt) || hasMore;

  return (
    <>
      <PageHeader title={text("التنبيهات", "Notifications")} to="/more" backMode="history" />
      <main className="rawaj-communication-v2 rawaj-communication-v2--notifications container-wide rawaj-content-stack mobile-page-bottom pt-4">
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
              {loading ? (
                <Panel title={text("جارٍ تحميل التنبيهات", "Loading notifications")} />
              ) : loadError ? (
                <Panel
                  title={text("تعذر تحميل التنبيهات", "Could not load notifications")}
                  body={loadError.message}
                  actionLabel={text("إعادة المحاولة", "Try again")}
                  onAction={() => void loadNotifications()}
                />
              ) : notifications.length === 0 ? (
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
  const target = notification.targetType?.toLowerCase();
  return Boolean(
    notification.targetId &&
    (target === "listing" || target === "conversation" || target === "seller"),
  );
}

function localizedNotification(notification: NotificationItem, language: "ar" | "en") {
  if (language === "ar") return { title: notification.titleAr, body: notification.bodyAr };
  const title =
    metadataString(notification.metadata, "title_en") ||
    metadataString(notification.metadata, "titleEn") ||
    notification.titleAr;
  const body =
    metadataString(notification.metadata, "body_en") ||
    metadataString(notification.metadata, "bodyEn") ||
    notification.bodyAr;
  return { title, body };
}

function metadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function Panel({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mt-4 rounded-2xl bg-muted-surface p-5 text-center hairline">
      <p className="text-sm font-bold">{title}</p>
      {body ? <p className="mt-1 text-xs leading-6 text-muted-foreground">{body}</p> : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 rounded-xl bg-card px-4 py-2 text-xs font-bold hairline"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function formatNotificationDate(value: string, language: "ar" | "en") {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
