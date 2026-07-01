import { Bell, CheckCheck, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  fetchMyNotifications,
  fetchUnreadNotificationsCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/classifieds-api";
import type { NotificationItem } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

interface Props {
  title?: string;
  to?: string;
  back?: boolean;
}

export function PageHeader({ title, to = "/", back = true }: Props) {
  const { text } = useUiPreferences();

  return (
    <div className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="container-wide flex items-center gap-2 py-3">
        {back && (
          <Link
            to={to}
            aria-label={text("رجوع", "Back")}
            className="grid h-9 w-9 place-items-center rounded-full bg-card hairline transition hover:bg-muted-surface"
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
        )}
        {title && <h1 className="truncate text-base font-extrabold">{title}</h1>}
        <NotificationsMenu />
      </div>
    </div>
  );
}

function NotificationsMenu() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const profileId = auth.profile?.id ?? null;

  async function refreshNotifications(loadList = open) {
    if (!profileId) return;
    setError("");
    const countResult = await fetchUnreadNotificationsCount(profileId);
    if (countResult.ok) setUnreadCount(countResult.data);
    else setError(countResult.error.message);

    if (!loadList) return;
    setLoading(true);
    const listResult = await fetchMyNotifications(profileId);
    setLoading(false);
    if (listResult.ok) setNotifications(listResult.data);
    else setError(listResult.error.message);
  }

  useEffect(() => {
    if (!profileId) {
      setNotifications([]);
      setUnreadCount(0);
      setError("");
      return;
    }
    void refreshNotifications(false);
  }, [profileId]);

  if (auth.status !== "signedIn" || !profileId) return null;

  async function toggleOpen() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) await refreshNotifications(true);
  }

  async function markOne(notificationId: string) {
    const result = await markNotificationRead(profileId, notificationId);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNotifications((current) =>
      current.map((item) =>
        item.id === notificationId ? { ...item, readAt: new Date().toISOString() } : item,
      ),
    );
    setUnreadCount((current) => Math.max(0, current - 1));
  }

  async function markAll() {
    const result = await markAllNotificationsRead(profileId);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => ({ ...item, readAt })));
    setUnreadCount(0);
  }

  return (
    <div className="relative ms-auto">
      <button
        type="button"
        onClick={() => void toggleOpen()}
        aria-label={text("الإشعارات", "Notifications")}
        className="relative grid h-9 w-9 place-items-center rounded-full bg-card hairline transition hover:bg-muted-surface"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -end-1 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-11 z-30 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-card p-3 text-start shadow-premium hairline">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-xs font-extrabold">{text("الإشعارات", "Notifications")}</h2>
            <button
              type="button"
              onClick={() => void markAll()}
              disabled={unreadCount === 0}
              className="inline-flex items-center gap-1 rounded-lg bg-muted-surface px-2 py-1 text-[10px] font-bold disabled:opacity-50"
            >
              <CheckCheck className="h-3 w-3" />
              {text("قراءة الكل", "Mark all read")}
            </button>
          </div>

          {loading ? (
            <p className="rounded-xl bg-muted-surface p-3 text-xs text-muted-foreground">
              {text("جارٍ تحميل الإشعارات.", "Loading notifications.")}
            </p>
          ) : error ? (
            <p className="rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive">
              {error}
            </p>
          ) : notifications.length === 0 ? (
            <p className="rounded-xl bg-muted-surface p-3 text-xs text-muted-foreground">
              {text("لا توجد إشعارات حالياً.", "No notifications yet.")}
            </p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {notifications.map((notification) => (
                <article
                  key={notification.id}
                  className={`rounded-xl p-3 hairline ${
                    notification.readAt ? "bg-card" : "bg-muted-surface"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold">{notification.titleAr}</h3>
                      {notification.bodyAr && (
                        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                          {notification.bodyAr}
                        </p>
                      )}
                    </div>
                    {!notification.readAt && (
                      <button
                        type="button"
                        onClick={() => void markOne(notification.id)}
                        className="shrink-0 rounded-lg bg-card px-2 py-1 text-[10px] font-bold hairline"
                      >
                        {text("تمت القراءة", "Read")}
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    {formatNotificationDate(notification.createdAt, language)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
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
