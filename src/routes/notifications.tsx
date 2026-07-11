import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bookmark, CheckCheck, Heart, MessageCircle, ScrollText, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  CommunicationCenterHero,
  CommunicationSectionHeader,
  CommunicationSignedOut,
  NotificationTimelineItem,
} from "@/features/communication/CommunicationExperience";
import { NotificationPreferencesPanel } from "@/features/notifications/NotificationPreferencesPanel";
import {
  fetchMyNotificationsPage,
  fetchUnreadNotificationsCount,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationTarget,
} from "@/lib/classifieds-api";
import type { ClassifiedsError, NotificationItem } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";
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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [paginationError, setPaginationError] = useState<ClassifiedsError | null>(null);
  const [openingTargetId, setOpeningTargetId] = useState<string | null>(null);
  const profileId = auth.profile?.id ?? null;
  const markInFlightRef = useRef<Set<string>>(new Set());
  const markAllInFlightRef = useRef(false);
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
    setError(null);
    setPaginationError(null);

    const [pageResult, unreadResult] = await Promise.all([
      fetchMyNotificationsPage(currentProfileId, 0, NOTIFICATIONS_PAGE_SIZE),
      fetchUnreadNotificationsCount(currentProfileId),
    ]);

    if (requestId !== notificationsRequestIdRef.current || currentProfileId !== profileId) return;

    if (pageResult.ok) {
      const nextItems = applyKnownReadState(pageResult.data.items);
      setNotifications(nextItems);
      setHasMore(pageResult.data.hasMore);
      setUnreadTotal(
        unreadResult.ok ? unreadResult.data : nextItems.filter((item) => !item.readAt).length,
      );
    } else {
      setError(pageResult.error);
      setHasMore(false);
      setUnreadTotal(0);
    }
    setLoading(false);
  }, [applyKnownReadState, profileId]);

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
      setError(null);
      setPaginationError(null);
      setOpeningTargetId(null);
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
      ) {
        return;
      }

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
    if (!profileId || markInFlightRef.current.has(notificationId)) return;
    const currentProfileId = profileId;
    const wasUnread = notifications.some((item) => item.id === notificationId && !item.readAt);
    markInFlightRef.current.add(notificationId);
    try {
      const result = await markNotificationRead(currentProfileId, notificationId);
      if (currentProfileId !== auth.profile?.id) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      readNotificationIdsRef.current.add(notificationId);
      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      );
      if (wasUnread) setUnreadTotal((current) => Math.max(0, current - 1));
    } finally {
      markInFlightRef.current.delete(notificationId);
    }
  }

  async function markAll() {
    if (!profileId || markAllInFlightRef.current) return;
    const currentProfileId = profileId;
    markAllInFlightRef.current = true;
    try {
      const result = await markAllNotificationsRead(currentProfileId);
      if (currentProfileId !== auth.profile?.id) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const readAt = new Date().toISOString();
      markAllReadAtRef.current = readAt;
      notifications.forEach((item) => readNotificationIdsRef.current.add(item.id));
      setNotifications((current) => current.map((item) => ({ ...item, readAt })));
      setUnreadTotal(0);
    } finally {
      markAllInFlightRef.current = false;
    }
  }

  async function openNotificationTarget(notification: NotificationItem) {
    if (!profileId || openingTargetId) return;
    setOpeningTargetId(notification.id);
    setError(null);
    const result = await resolveNotificationTarget(profileId, notification);
    setOpeningTargetId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const target = result.data;
    if (!target) return;

    if (target.kind === "listing") {
      void navigate({ to: "/listings/$id", params: { id: target.listingId } });
    } else if (target.kind === "conversation") {
      void navigate({ to: "/chats", search: { conversation: target.conversationId } });
    } else if (target.kind === "conversation_missing") {
      void navigate({ to: "/chats", search: { conversation: target.conversationId } });
    } else if (target.kind === "seller") {
      void navigate({ to: "/seller/$id", params: { id: target.sellerId } });
    } else if (target.kind === "browse_listings") {
      void navigate({ to: "/listings" });
    }
  }

  function isNavigableNotification(notification: NotificationItem) {
    const target = notification.targetType?.toLowerCase();
    const supportedTarget =
      target === "listing" || target === "conversation" || target === "seller";
    return Boolean(notification.targetId && supportedTarget);
  }

  return (
    <>
      <PageHeader title={text("التنبيهات", "Notifications")} to="/more" backMode="history" />
      <main className="rawaj-communication-v2 rawaj-communication-v2--notifications container-wide mobile-page-bottom space-y-5 pt-4">
        {auth.status !== "signedIn" ? (
          <CommunicationSignedOut returnTo="/notifications" />
        ) : (
          <section className="space-y-4">
            <CommunicationCenterHero
              mode="notifications"
              unreadNotifications={unreadTotal}
              actions={
                <button
                  type="button"
                  disabled={unreadTotal === 0 || markAllInFlightRef.current}
                  onClick={() => void markAll()}
                >
                  <CheckCheck aria-hidden="true" />
                  {text("قراءة الكل", "Mark all read")}
                </button>
              }
            />
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
              ) : error ? (
                <Panel
                  title={text("تعذر تحميل التنبيهات", "Could not load notifications")}
                  body={error.message}
                />
              ) : notifications.length === 0 ? (
                <Panel
                  title={text("لا توجد تنبيهات جديدة حالياً", "No new notifications right now")}
                  body={text(
                    "لا توجد عناصر غير مقروءة أو محفوظة حالياً. استخدم الروابط السريعة لمتابعة الرسائل والإعلانات والطلبات.",
                    "There are no unread or saved items right now. Use the quick links to follow messages, listings, and requests.",
                  )}
                />
              ) : (
                <div className="rawaj-notification-list">
                  {notifications.map((notification) => (
                    <NotificationTimelineItem
                      key={notification.id}
                      notification={notification}
                      navigable={isNavigableNotification(notification)}
                      opening={openingTargetId === notification.id}
                      onOpen={() => void openNotificationTarget(notification)}
                      onMarkRead={() => void markOne(notification.id)}
                      dateLabel={formatNotificationDate(notification.createdAt, language)}
                    />
                  ))}

                  {paginationError && (
                    <div className="rounded-xl bg-destructive/10 p-3 text-center text-xs font-semibold text-destructive">
                      {paginationError.message}
                    </div>
                  )}

                  {hasMore && (
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
                  )}
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

function Panel({ title, body }: { title: string; body?: string }) {
  return (
    <div className="mt-4 rounded-2xl bg-muted-surface p-5 text-center hairline">
      <p className="text-sm font-bold">{title}</p>
      {body && <p className="mt-1 text-xs leading-6 text-muted-foreground">{body}</p>}
    </div>
  );
}

function formatNotificationDate(value: string, language: "ar" | "en") {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
