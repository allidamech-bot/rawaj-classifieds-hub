import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bell, LogIn, MessageCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import { fetchMyConversations, fetchMyNotificationsPage } from "@/lib/classifieds-api";
import type { ClassifiedsError, Conversation, NotificationItem } from "@/lib/classifieds-types";
import { useUnreadActivityCounts } from "@/lib/unread-activity";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

const activitySearchSchema = z.object({
  tab: z.enum(["notifications", "messages"]).optional(),
});

type ActivityTab = "notifications" | "messages";

export const Route = createFileRoute("/activity")({
  validateSearch: activitySearchSchema,
  head: () => ({
    meta: [{ title: "مركز النشاط | رواج" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: ActivityCenterPage,
});

function ActivityCenterPage() {
  const auth = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { language, text } = useUiPreferences();
  const { counts } = useUnreadActivityCounts();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [notificationError, setNotificationError] = useState<ClassifiedsError | null>(null);
  const [conversationError, setConversationError] = useState<ClassifiedsError | null>(null);
  const requestIdRef = useRef(0);
  const profileId = auth.profile?.id ?? null;
  const activeTab: ActivityTab = search.tab ?? "notifications";

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId) {
      requestIdRef.current += 1;
      setNotifications([]);
      setConversations([]);
      setLoading(false);
      setNotificationError(null);
      setConversationError(null);
      return;
    }

    const currentProfileId = profileId;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setNotificationError(null);
    setConversationError(null);

    void Promise.all([
      fetchMyNotificationsPage(currentProfileId, 0, 8),
      fetchMyConversations(currentProfileId),
    ]).then(([notificationResult, conversationResult]) => {
      if (requestId !== requestIdRef.current || currentProfileId !== auth.profile?.id) return;

      if (notificationResult.ok) {
        setNotifications(notificationResult.data.items);
      } else {
        setNotifications([]);
        setNotificationError(notificationResult.error);
      }

      if (conversationResult.ok) {
        setConversations(conversationResult.data.slice(0, 8));
      } else {
        setConversations([]);
        setConversationError(conversationResult.error);
      }

      setLoading(false);
    });
  }, [auth.status, auth.profile?.id, profileId]);

  function selectTab(tab: ActivityTab) {
    void navigate({
      to: "/activity",
      search: { tab },
      replace: true,
    });
  }

  if (auth.status !== "signedIn") {
    return (
      <>
        <PageHeader title={text("مركز النشاط", "Activity center")} to="/more" backMode="history" />
        <main className="container-wide mobile-page-bottom pt-4">
          <section className="rounded-2xl bg-card p-8 text-center hairline">
            <LogIn className="mx-auto h-8 w-8 text-primary" />
            <h1 className="mt-3 text-base font-extrabold">
              {text("تسجيل الدخول مطلوب", "Login required")}
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-muted-foreground">
              {text(
                "سجّل الدخول لمتابعة رسائلك وتنبيهاتك من مركز واحد.",
                "Log in to follow messages and notifications from one center.",
              )}
            </p>
            <Link
              to="/login"
              search={{ returnTo: "/activity" }}
              className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              {text("تسجيل الدخول", "Log in")}
            </Link>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader title={text("مركز النشاط", "Activity center")} to="/more" backMode="history" />
      <main className="container-wide mobile-page-bottom space-y-4 pt-4">
        <section className="rounded-2xl bg-card p-4 hairline">
          <h1 className="text-lg font-extrabold">{text("نشاطك", "Your activity")}</h1>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">
            {text(
              "تابع ما يحتاج انتباهك ومحادثات البيع والشراء دون التنقل بين مراكز متفرقة.",
              "Follow what needs attention and buyer-seller conversations without jumping between separate hubs.",
            )}
          </p>

          <div
            className="mt-4 grid grid-cols-2 gap-2"
            role="tablist"
            aria-label={text("أقسام النشاط", "Activity sections")}
          >
            <ActivityTabButton
              active={activeTab === "notifications"}
              count={counts.notifications}
              icon={Bell}
              label={text("الإشعارات", "Notifications")}
              onClick={() => selectTab("notifications")}
            />
            <ActivityTabButton
              active={activeTab === "messages"}
              count={counts.messages}
              icon={MessageCircle}
              label={text("الرسائل", "Messages")}
              onClick={() => selectTab("messages")}
            />
          </div>
        </section>

        {activeTab === "notifications" ? (
          <section className="rounded-2xl bg-card p-4 hairline" role="tabpanel">
            <ActivitySectionHeader
              title={text("آخر الإشعارات", "Latest notifications")}
              to="/notifications"
              action={text("عرض الكل", "View all")}
            />
            {loading ? (
              <ActivityState>{text("جارٍ تحميل النشاط.", "Loading activity.")}</ActivityState>
            ) : notificationError ? (
              <ActivityState>{notificationError.message}</ActivityState>
            ) : notifications.length === 0 ? (
              <ActivityState>
                {text("لا توجد إشعارات محفوظة حاليًا.", "No saved notifications right now.")}
              </ActivityState>
            ) : (
              <div className="mt-3 space-y-2">
                {notifications.map((notification) => (
                  <article
                    key={notification.id}
                    className={`rounded-xl p-3 hairline ${notification.readAt ? "bg-card" : "bg-muted-surface"}`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notification.readAt ? "bg-border" : "bg-gold"}`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-bold">{notification.titleAr}</h2>
                        {notification.bodyAr ? (
                          <p className="mt-1 line-clamp-2 text-xs leading-6 text-muted-foreground">
                            {notification.bodyAr}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {formatDateTime(notification.createdAt, language)}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="rounded-2xl bg-card p-4 hairline" role="tabpanel">
            <ActivitySectionHeader
              title={text("آخر المحادثات", "Latest conversations")}
              to="/chats"
              action={text("فتح الرسائل", "Open messages")}
            />
            {loading ? (
              <ActivityState>{text("جارٍ تحميل النشاط.", "Loading activity.")}</ActivityState>
            ) : conversationError ? (
              <ActivityState>{conversationError.message}</ActivityState>
            ) : conversations.length === 0 ? (
              <ActivityState>{text("لا توجد محادثات بعد.", "No conversations yet.")}</ActivityState>
            ) : (
              <div className="mt-3 space-y-2">
                {conversations.map((conversation) => (
                  <Link
                    key={conversation.id}
                    to="/chats"
                    search={{ conversation: conversation.id }}
                    className="flex min-h-11 items-center gap-3 rounded-xl bg-muted-surface p-3 transition hover:bg-secondary hairline"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-card text-sm font-bold text-primary hairline">
                      {conversation.otherParticipant.avatarUrl ? (
                        <img
                          src={conversation.otherParticipant.avatarUrl}
                          alt={conversation.otherParticipant.displayName}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        conversation.otherParticipant.displayName.slice(0, 1)
                      )}
                    </span>
                    <span className="min-w-0 flex-1 text-start">
                      <strong className="block truncate text-sm">
                        {conversation.otherParticipant.displayName}
                      </strong>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {conversation.lastMessagePreview || conversation.listingTitle}
                      </span>
                    </span>
                    {conversation.unreadCount > 0 ? (
                      <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-gold-foreground">
                        {conversation.unreadCount}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </>
  );
}

function ActivityTabButton({
  active,
  count,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  icon: typeof Bell;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition hairline ${
        active ? "bg-primary text-primary-foreground" : "bg-muted-surface text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
      {count > 0 ? (
        <span className="rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold text-gold-foreground">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function ActivitySectionHeader({
  title,
  to,
  action,
}: {
  title: string;
  to: "/notifications" | "/chats";
  action: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-extrabold">{title}</h2>
      <Link
        to={to}
        className="inline-flex min-h-11 items-center rounded-xl px-3 py-2 text-xs font-bold text-primary"
      >
        {action}
      </Link>
    </div>
  );
}

function ActivityState({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-xl bg-muted-surface p-4 text-center text-xs leading-6 text-muted-foreground hairline">
      {children}
    </p>
  );
}

function formatDateTime(value: string, language: "ar" | "en") {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
