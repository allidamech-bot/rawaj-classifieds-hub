import { Bell, MessageSquare, FileText, Users, ShieldAlert, ListChecks } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  adminFetchNotifications,
  adminMarkNotificationsReadByEntity,
  notifyAdminNotificationsUpdated,
  type AdminNotificationItem,
} from "@/lib/api/admin-notifications";
import { useAuth } from "@/lib/use-auth";
import { useUiPreferences } from "@/lib/ui-preferences";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({
    title: "الإشعارات | رَوَاج",
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminNotificationsPage,
});

const FILTERS = [
  { key: "all", labelAr: "الكل", labelEn: "All", icon: Bell },
  { key: "users", labelAr: "المستخدمون", labelEn: "Users", icon: Users },
  { key: "listings", labelAr: "الإعلانات", labelEn: "Listings", icon: FileText },
  { key: "feedback", labelAr: "الملاحظات والشكاوى", labelEn: "Feedback", icon: MessageSquare },
  { key: "support", labelAr: "طلبات الدعم", labelEn: "Support", icon: ShieldAlert },
  { key: "reports", labelAr: "البلاغات", labelEn: "Reports", icon: ListChecks },
];

const ENTITY_ROUTES: Record<string, string> = {
  users: "/admin/users",
  listings: "/admin/pending",
  feedback: "/admin/owner-controls",
  support: "/admin/owner-controls",
  reports: "/admin/reports",
};

function AdminNotificationsPage() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  const canAccess = auth.canAccessAdmin;

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminFetchNotifications(canAccess, filter === "all" ? undefined : filter)
      .then((result) => {
        if (!cancelled) {
          if (result.ok) {
            setItems(result.data);
          } else {
            setError(result.error.message);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setError(text("تعذر تحميل الإشعارات.", "Failed to load notifications."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canAccess, filter]);

  const handleItemClick = async (item: AdminNotificationItem) => {
    const destination = ENTITY_ROUTES[item.entityType];
    if (!destination) return;

    if (!item.readAt) {
      const result = await adminMarkNotificationsReadByEntity(
        canAccess,
        item.entityType,
        item.entityId,
      );
      if (result.ok) {
        const readAt = new Date().toISOString();
        setItems((current) =>
          current.map((candidate) =>
            candidate.entityType === item.entityType && candidate.entityId === item.entityId
              ? { ...candidate, readAt: candidate.readAt ?? readAt }
              : candidate,
          ),
        );
        notifyAdminNotificationsUpdated();
      }
    }

    navigate({ to: destination });
  };

  const unreadCount = useMemo(() => items.filter((item) => !item.readAt).length, [items]);

  return (
    <>
      <PageHeader title={text("الإشعارات", "Notifications")} />
      <main className="container-wide pb-8 pt-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {FILTERS.map((item) => {
            const Icon = item.icon;
            const active = filter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted-surface text-foreground hover:bg-muted-surface/80"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {text(item.labelAr, item.labelEn)}
              </button>
            );
          })}
          <span className="mr-auto text-xs text-muted-foreground">
            {text(`${unreadCount} غير مقروء`, `${unreadCount} unread`)}
          </span>
        </div>

        {loading ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {text("جارٍ تحميل الإشعارات...", "Loading notifications...")}
          </p>
        ) : error ? (
          <p className="py-6 text-center text-xs text-warning">{error}</p>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {text("لا توجد إشعارات حالياً.", "No notifications right now.")}
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                onClick={() => void handleItemClick(item)}
                text={text}
                language={language}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function NotificationRow({
  item,
  onClick,
  text,
  language,
}: {
  item: AdminNotificationItem;
  onClick: () => void;
  text: (ar: string, en: string) => string;
  language: string;
}) {
  const isUnread = !item.readAt;
  const Icon = FILTERS.find((f) => f.key === item.entityType)?.icon ?? Bell;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-right transition-colors ${
        isUnread ? "border-primary/30 bg-primary/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 grid h-9 w-9 place-items-center rounded-xl ${
            isUnread ? "bg-primary/15 text-primary" : "bg-muted-surface text-muted-foreground"
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={`text-xs font-extrabold ${isUnread ? "text-foreground" : "text-muted-foreground"}`}
          >
            {item.title}
          </p>
          {item.body ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.body}</p>
          ) : null}
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            {new Date(item.createdAt).toLocaleString(language === "en" ? "en-US" : "ar-SA")}
          </p>
        </div>
        {isUnread ? (
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
        ) : null}
      </div>
    </button>
  );
}
