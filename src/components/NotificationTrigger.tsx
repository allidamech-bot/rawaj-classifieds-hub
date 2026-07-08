import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchMyNotifications,
  fetchUnreadNotificationsCount,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationTarget,
  scanOwnerListingExpiryReminders,
} from "@/lib/classifieds-api";
import type { NotificationItem } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export function NotificationTrigger({ tone = "light" }: { tone?: "light" | "dark" }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const { language, text } = useUiPreferences();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [openingTargetId, setOpeningTargetId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const profileId = auth.profile?.id ?? null;

  const refreshNotifications = useCallback(
    async (loadList: boolean) => {
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
    },
    [profileId],
  );

  useEffect(() => {
    if (!profileId) {
      setNotifications([]);
      setUnreadCount(0);
      setError("");
      setOpeningTargetId(null);
      return;
    }
    void refreshNotifications(false);
  }, [profileId, refreshNotifications]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && !containerRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  if (auth.status !== "signedIn" || !profileId) return null;

  async function toggleOpen() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      await scanOwnerListingExpiryReminders(profileId);
      await refreshNotifications(true);
    }
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

  async function openNotificationTarget(notification: NotificationItem) {
    if (openingTargetId || !profileId) return;
    setOpeningTargetId(notification.id);
    setError("");
    const result = await resolveNotificationTarget(profileId, notification);
    setOpeningTargetId(null);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    const target = result.data;
    if (!target) return;

    if (!notification.readAt) await markOne(notification.id);
    setOpen(false);

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

  function canOpenNotificationTarget(notification: NotificationItem) {
    const target = notification.targetType?.toLowerCase();
    return Boolean(
      notification.targetId && ["listing", "conversation", "seller"].includes(target ?? ""),
    );
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

  function openNotificationCenter() {
    setOpen(false);
    void navigate({ to: "/notifications" });
  }

  const triggerClass =
    tone === "dark"
      ? "relative grid h-9 w-9 place-items-center rounded-full border border-primary-foreground/15 bg-primary-foreground/[0.06] text-primary-foreground/85 backdrop-blur transition hover:border-gold/50 hover:bg-primary-foreground/10 hover:text-gold active:scale-[0.98] sm:h-10 sm:w-10"
      : "relative grid h-9 w-9 place-items-center rounded-full bg-card hairline transition hover:bg-muted-surface active:scale-[0.98]";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => void toggleOpen()}
        aria-label={text("الإشعارات", "Notifications")}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={text("الإشعارات", "Notifications")}
        className={triggerClass}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -end-1 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={text("الإشعارات", "Notifications")}
          className="absolute end-0 top-11 z-30 w-80 max-w-[calc(100vw-2rem)] bg-card p-3 text-start text-foreground shadow-premium hairline"
        >
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
              {text("جاري تحميل الإشعارات.", "Loading notifications.")}
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
              {notifications.map((notification) => {
                const canOpenTarget = canOpenNotificationTarget(notification);
                const openingTarget = openingTargetId === notification.id;
                return (
                  <article
                    key={notification.id}
                    onClick={
                      canOpenTarget ? () => void openNotificationTarget(notification) : undefined
                    }
                    className={`rounded-xl p-3 hairline ${
                      notification.readAt ? "bg-card" : "bg-muted-surface"
                    } ${canOpenTarget ? "cursor-pointer" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
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
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      {openingTarget
                        ? text("جارٍ فتح الهدف...", "Opening target...")
                        : formatNotificationDate(notification.createdAt, language)}
                    </p>
                  </article>
                );
              })}
            </div>
          )}

          <div className="mt-3 border-t border-border/70 pt-3">
            <button
              type="button"
              onClick={openNotificationCenter}
              className="w-full rounded-lg bg-muted-surface px-3 py-2 text-xs font-bold transition hover:bg-muted"
            >
              {text("فتح مركز الإشعارات", "Open notification center")}
            </button>
          </div>
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
