import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationTarget,
  scanOwnerListingExpiryReminders,
} from "@/lib/classifieds-api";
import type { NotificationItem } from "@/lib/classifieds-types";
import { marketLocale } from "@/lib/market-locale";
import { notificationIsWithinReadCutoff } from "@/lib/notification-integrity";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useUnreadActivityCounts } from "@/lib/unread-activity";
import { useAuth } from "@/lib/use-auth";

export function NotificationTrigger({ tone = "light" }: { tone?: "light" | "dark" }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const { language, text } = useUiPreferences();
  const { counts, refresh: refreshUnreadActivity } = useUnreadActivityCounts();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [openingTargetId, setOpeningTargetId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const profileId = auth.profile?.id ?? null;
  const profileIdRef = useRef<string | null>(profileId);
  const requestIdRef = useRef(0);
  const markingReadRef = useRef<Set<string>>(new Set());
  const markingAllRef = useRef(false);
  profileIdRef.current = profileId;
  const unreadCount = counts.notifications;

  const refreshNotifications = useCallback(
    async (loadList: boolean) => {
      if (!profileId) return;
      const currentProfileId = profileId;
      const requestId = ++requestIdRef.current;
      setError("");
      await refreshUnreadActivity();
      if (
        !loadList ||
        requestId !== requestIdRef.current ||
        currentProfileId !== profileIdRef.current
      )
        return;
      setLoading(true);
      const listResult = await fetchMyNotifications({ limit: 20 });
      if (requestId !== requestIdRef.current || currentProfileId !== profileIdRef.current) return;
      setLoading(false);
      if (listResult.ok) setNotifications(listResult.data);
      else setError(listResult.error.message);
    },
    [profileId, refreshUnreadActivity],
  );

  useEffect(() => {
    if (!profileId) {
      requestIdRef.current += 1;
      setNotifications([]);
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
    const currentProfileId = profileId;
    if (!currentProfileId || markingReadRef.current.has(notificationId)) return;
    markingReadRef.current.add(notificationId);
    const result = await markNotificationRead(notificationId);
    markingReadRef.current.delete(notificationId);
    if (currentProfileId !== profileIdRef.current) return;
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setNotifications((current) =>
      current.map((item) =>
        item.id === notificationId ? { ...item, readAt: new Date().toISOString() } : item,
      ),
    );
    void refreshUnreadActivity();
  }

  async function openNotificationTarget(notification: NotificationItem) {
    if (openingTargetId || !profileId) return;
    setOpeningTargetId(notification.id);
    setError("");
    const currentProfileId = profileId;
    const result = await resolveNotificationTarget(notification.id);
    if (currentProfileId !== profileIdRef.current) return;
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
    } else if (target.kind === "owner_listing") {
      void navigate({ to: "/profile/listings/$id", params: { id: target.listingId } });
    } else if (target.kind === "seller") {
      void navigate({ to: "/seller/$id", params: { id: target.sellerId } });
    } else if (target.kind === "browse_listings") {
      void navigate({ to: "/listings" });
    } else if (target.kind === "saved_search") {
      void navigate({
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
    } else if (target.kind === "support") {
      void navigate({ to: "/support" });
    } else if (target.kind === "verification") {
      void navigate({ to: "/verification" });
    } else if (target.kind === "promotion") {
      void navigate({ to: "/promotion" });
    }
  }

  function canOpenNotificationTarget(notification: NotificationItem) {
    const target = notification.targetType?.toLowerCase();
    return Boolean(
      notification.targetId &&
      [
        "listing",
        "owner_listing",
        "conversation",
        "seller",
        "saved_search",
        "support",
        "verification",
        "promotion",
      ].includes(target ?? ""),
    );
  }

  async function markAll() {
    const currentProfileId = profileId;
    if (!currentProfileId || markingAllRef.current) return;
    markingAllRef.current = true;
    const result = await markAllNotificationsRead();
    markingAllRef.current = false;
    if (currentProfileId !== profileIdRef.current) return;
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    const readAt = result.data.cutoff;
    setNotifications((current) =>
      current.map((item) =>
        notificationIsWithinReadCutoff(item, readAt) ? { ...item, readAt } : item,
      ),
    );
    void refreshUnreadActivity();
  }

  function openNotificationCenter() {
    setOpen(false);
    void navigate({ to: "/notifications" });
  }

  const triggerClass =
    tone === "dark"
      ? "relative grid rawaj-touch-target place-items-center rounded-[var(--rawaj-radius-button)] border border-primary-foreground/15 bg-primary-foreground/[0.06] text-primary-foreground/85 transition-colors hover:border-gold/50 hover:bg-primary-foreground/10 hover:text-gold"
      : "relative grid rawaj-touch-target place-items-center rounded-[var(--rawaj-radius-button)] bg-card text-primary hairline transition-colors hover:bg-muted-surface";

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
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={text("الإشعارات", "Notifications")}
          className="fixed inset-x-3 top-16 z-40 rounded-[var(--rawaj-radius-surface)] bg-card p-3 text-start text-foreground shadow-[var(--rawaj-shadow-overlay)] hairline sm:absolute sm:inset-x-auto sm:end-0 sm:top-12 sm:z-30 sm:w-80 sm:max-w-[calc(100vw-2rem)]"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-xs font-extrabold">{text("الإشعارات", "Notifications")}</h2>
            <button
              type="button"
              onClick={() => void markAll()}
              disabled={unreadCount === 0}
              className="inline-flex min-h-11 items-center gap-1 rounded-[var(--rawaj-radius-button)] bg-muted-surface px-3 text-[10px] font-bold disabled:opacity-50"
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
                        <h3 className="text-xs font-bold">
                          {language === "en"
                            ? notification.titleEn || notification.titleAr
                            : notification.titleAr}
                        </h3>
                        {(language === "en"
                          ? notification.bodyEn || notification.bodyAr
                          : notification.bodyAr) && (
                          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                            {language === "en"
                              ? notification.bodyEn || notification.bodyAr
                              : notification.bodyAr}
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
                          className="min-h-11 shrink-0 rounded-[var(--rawaj-radius-button)] bg-card px-2 text-[10px] font-bold hairline"
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
              className="min-h-11 w-full rounded-[var(--rawaj-radius-button)] bg-muted-surface px-3 text-xs font-bold transition-colors hover:bg-muted"
            >
              {text("فتح مركز الإشعارات", "Open notification center")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatNotificationDate(value: string, language: Language) {
  if (!value) return "";
  return new Intl.DateTimeFormat(marketLocale(language), {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
