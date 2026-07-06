import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Bookmark,
  CheckCheck,
  Heart,
  LogIn,
  MessageCircle,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/classifieds-api";
import type { ClassifiedsError, NotificationItem } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/notifications")({
  component: NotificationsPage,
});

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
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const profileId = auth.profile?.id ?? null;
  const markInFlightRef = useRef<Set<string>>(new Set());
  const markAllInFlightRef = useRef(false);
  const notificationsRequestIdRef = useRef(0);
  const mutationRequestIdRef = useRef(0);

  async function loadNotifications() {
    if (!profileId) return;
    const requestId = ++notificationsRequestIdRef.current;
    setLoading(true);
    setError(null);
    const result = await fetchMyNotifications(profileId);
    if (requestId !== notificationsRequestIdRef.current || profileId !== auth.profile?.id) return;
    if (result.ok) setNotifications(result.data);
    else setError(result.error);
    setLoading(false);
  }

  useEffect(() => {
    if (auth.status !== "signedIn") {
      notificationsRequestIdRef.current += 1;
      mutationRequestIdRef.current += 1;
      setNotifications([]);
      setLoading(false);
      return;
    }
    void loadNotifications();
  }, [auth.status, profileId]);

  async function markOne(notificationId: string) {
    if (!profileId || markInFlightRef.current.has(notificationId)) return;
    const mutationId = ++mutationRequestIdRef.current;
    const currentProfileId = profileId;
    markInFlightRef.current.add(notificationId);
    try {
      const result = await markNotificationRead(currentProfileId, notificationId);
      if (mutationId !== mutationRequestIdRef.current || currentProfileId !== auth.profile?.id) {
        return;
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      );
    } finally {
      markInFlightRef.current.delete(notificationId);
    }
  }

  async function markAll() {
    if (!profileId || markAllInFlightRef.current) return;
    const mutationId = ++mutationRequestIdRef.current;
    const currentProfileId = profileId;
    markAllInFlightRef.current = true;
    try {
      const result = await markAllNotificationsRead(currentProfileId);
      if (mutationId !== mutationRequestIdRef.current || currentProfileId !== auth.profile?.id) {
        return;
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, readAt })));
    } finally {
      markAllInFlightRef.current = false;
    }
  }

  function openNotificationTarget(notification: NotificationItem) {
    if (!notification.targetType || !notification.targetId) return;
    const target = notification.targetType.toLowerCase();
    if (target === "listing") {
      void navigate({ to: "/listings/$id", params: { id: notification.targetId } });
    } else if (target === "conversation") {
      void navigate({ to: "/chats", search: { conversation: notification.targetId } });
    } else if (target === "seller") {
      void navigate({ to: "/seller/$id", params: { id: notification.targetId } });
    }
  }

  function isNavigableNotification(notification: NotificationItem) {
    const target = notification.targetType?.toLowerCase();
    return Boolean(
      notification.targetId &&
      (target === "listing" || target === "conversation" || target === "seller"),
    );
  }

  const unreadCount = notifications.filter((item) => !item.readAt).length;

  return (
    <>
      <PageHeader title={text("التنبيهات", "Notifications")} to="/more" backMode="history" />
      <main className="container-wide mobile-page-bottom space-y-5 pt-4">
        {auth.status !== "signedIn" ? (
          <section className="rounded-2xl bg-card p-8 text-center shadow-soft hairline">
            <LogIn className="mx-auto h-8 w-8 text-gold" />
            <h1 className="mt-3 text-base font-extrabold">
              {text("تسجيل الدخول مطلوب", "Login required")}
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-muted-foreground">
              {text(
                "سجّل الدخول لمتابعة تنبيهات الحساب والإعلانات عند توفرها.",
                "Log in to follow account and listing notifications when available.",
              )}
            </p>
            <Link
              to="/login"
              className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              {text("تسجيل الدخول", "Log in")}
            </Link>
          </section>
        ) : (
          <section className="rounded-2xl bg-card p-4 shadow-soft hairline">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gold/15 text-gold">
                  <Bell className="h-6 w-6" />
                </span>
                <div>
                  <h1 className="text-lg font-extrabold">
                    {text("تنبيهات الحساب", "Account notifications")}
                  </h1>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">
                    {text(
                      "تظهر هنا إشعارات الحساب والإعلانات عند توفرها.",
                      "Account and listing notifications appear here when available.",
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={unreadCount === 0}
                onClick={() => void markAll()}
                className="inline-flex items-center gap-1 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold disabled:opacity-50 hairline"
              >
                <CheckCheck className="h-4 w-4" />
                {text("قراءة الكل", "Mark all read")}
              </button>
            </div>

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
                  "يمكنك متابعة الرسائل والإعلانات والطلبات من الروابط السريعة أدناه.",
                  "Use the quick links below to follow messages, listings, and requests.",
                )}
              />
            ) : (
              <div className="mt-4 space-y-2">
                {notifications.map((notification) => (
                  <article
                    key={notification.id}
                    className={`rounded-xl p-3 hairline ${notification.readAt ? "bg-card" : "bg-muted-surface"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div
                        role={isNavigableNotification(notification) ? "button" : undefined}
                        tabIndex={isNavigableNotification(notification) ? 0 : undefined}
                        className={`min-w-0 flex-1 ${
                          isNavigableNotification(notification) ? "cursor-pointer" : ""
                        }`}
                        onClick={() => openNotificationTarget(notification)}
                        onKeyDown={(event) => {
                          if (!isNavigableNotification(notification)) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openNotificationTarget(notification);
                          }
                        }}
                      >
                        <h2 className="text-sm font-bold">{notification.titleAr}</h2>
                        {notification.bodyAr && (
                          <p className="mt-1 text-xs leading-6 text-muted-foreground">
                            {notification.bodyAr}
                          </p>
                        )}
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          {formatNotificationDate(notification.createdAt, language)}
                        </p>
                      </div>
                      {!notification.readAt && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void markOne(notification.id);
                          }}
                          className="shrink-0 rounded-lg bg-card px-2 py-1 text-[10px] font-bold hairline"
                        >
                          {text("تمت القراءة", "Read")}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="rounded-2xl bg-card p-4 hairline">
          <h2 className="text-sm font-extrabold">{text("متابعة سريعة", "Quick follow-up")}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
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

function formatNotificationDate(value: string, language: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
