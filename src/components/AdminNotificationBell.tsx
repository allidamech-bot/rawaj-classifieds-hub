import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  adminFetchNotificationSummary,
  type AdminNotificationSummary,
} from "@/lib/api/admin-notifications";
import { useAuth } from "@/lib/use-auth";
import { useUiPreferences } from "@/lib/ui-preferences";

export function AdminNotificationBell() {
  const auth = useAuth();
  const { text } = useUiPreferences();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<AdminNotificationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const canAccess = auth.canAccessAdmin;

  const unreadTotal = summary?.unreadTotal ?? 0;

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    setLoading(true);
    adminFetchNotificationSummary(canAccess)
      .then((result) => {
        if (!cancelled && result.ok) setSummary(result.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canAccess]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (!canAccess) return null;

  return (
    <div className="relative inline-flex shrink-0" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="rawaj-icon-button rawaj-touch-target relative grid h-9 w-9 place-items-center rounded-xl text-foreground hover:bg-muted-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={text("الإشعارات", "Notifications")}
        title={text("الإشعارات", "Notifications")}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadTotal > 0 ? (
          <span className="absolute -top-0.5 -left-0.5 min-w-[18px] rounded-full bg-red-500 px-1 text-center text-[10px] font-extrabold leading-5 text-white">
            {unreadTotal > 99 ? "99+" : unreadTotal}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-2xl border border-border bg-card p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs font-extrabold">{text("الإشعارات", "Notifications")}</p>
            <span className="text-[10px] text-muted-foreground">
              {text(`${unreadTotal} غير مقروء`, `${unreadTotal} unread`)}
            </span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                {text("جارٍ التحميل...", "Loading notifications...")}
              </p>
            ) : !summary || unreadTotal === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                {text("لا توجد إشعارات جديدة.", "No new notifications.")}
              </p>
            ) : (
              <div className="space-y-1">
                {Object.entries(summary.byType).map(([type, count]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      navigate({ to: "/admin/notifications", search: { entityType: type } });
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs hover:bg-muted-surface"
                  >
                    <span className="font-bold">{typeLabel(type, text)}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold text-primary">
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-2 border-t border-border pt-2">
            <button
              type="button"
              onClick={() => {
                navigate({ to: "/admin/notifications" });
                setOpen(false);
              }}
              className="block w-full rounded-xl px-3 py-2 text-center text-xs font-bold text-primary hover:bg-muted-surface"
            >
              {text("عرض كل الإشعارات", "View all notifications")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function typeLabel(type: string, text: (ar: string, en: string) => string): string {
  const map: Record<string, [string, string]> = {
    users: ["المستخدمون", "Users"],
    listings: ["الإعلانات", "Listings"],
    feedback: ["الملاحظات والشكاوى", "Feedback"],
    support: ["طلبات الدعم", "Support"],
    reports: ["البلاغات", "Reports"],
  };
  const entry = map[type];
  return entry ? text(entry[0], entry[1]) : type;
}
