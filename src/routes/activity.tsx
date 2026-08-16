import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bell, MessageCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import {
  CommunicationCenterHero,
  CommunicationSignedOut,
  ParticipantAvatar,
} from "@/features/communication/CommunicationExperience";
import { fetchMyConversations, fetchMyNotificationsPage } from "@/lib/classifieds-api";
import type { ClassifiedsError, Conversation, NotificationItem } from "@/lib/classifieds-types";
import { marketLocale } from "@/lib/market-locale";
import { mergeNotifications } from "@/lib/notification-integrity";
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
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [hasLoadedNotifications, setHasLoadedNotifications] = useState(false);
  const [hasLoadedConversations, setHasLoadedConversations] = useState(false);
  const [notificationError, setNotificationError] = useState<ClassifiedsError | null>(null);
  const [conversationError, setConversationError] = useState<ClassifiedsError | null>(null);
  const [loadedProfileId, setLoadedProfileId] = useState<string | null>(null);
  const notificationRequestIdRef = useRef(0);
  const conversationRequestIdRef = useRef(0);
  const profileId = auth.profile?.id ?? null;
  const profileIdRef = useRef<string | null>(profileId);
  profileIdRef.current = profileId;
  const activeTab: ActivityTab = search.tab ?? "notifications";

  const loadNotifications = useCallback(async () => {
    if (!profileId) return;

    const currentProfileId = profileId;
    const requestId = ++notificationRequestIdRef.current;
    setNotificationsLoading(true);
    setNotificationError(null);
    try {
      const result = await fetchMyNotificationsPage({ limit: 8 });
      if (
        requestId !== notificationRequestIdRef.current ||
        currentProfileId !== profileIdRef.current
      )
        return;

      if (result.ok) {
        setNotifications((current) => mergeNotifications(current, result.data.items));
        setLoadedProfileId(currentProfileId);
        setHasLoadedNotifications(true);
      } else {
        setNotificationError(result.error);
      }
    } catch (caught) {
      if (
        requestId === notificationRequestIdRef.current &&
        currentProfileId === profileIdRef.current
      ) {
        setNotificationError({
          code: "unknown",
          message:
            caught instanceof Error
              ? caught.message
              : text("تعذر تحميل الإشعارات.", "Could not load notifications."),
          operation: "activity_notifications_load",
        });
      }
    } finally {
      if (
        requestId === notificationRequestIdRef.current &&
        currentProfileId === profileIdRef.current
      )
        setNotificationsLoading(false);
    }
  }, [profileId, text]);

  const loadConversations = useCallback(async () => {
    if (!profileId) return;

    const currentProfileId = profileId;
    const requestId = ++conversationRequestIdRef.current;
    setConversationsLoading(true);
    setConversationError(null);
    try {
      const result = await fetchMyConversations();
      if (
        requestId !== conversationRequestIdRef.current ||
        currentProfileId !== profileIdRef.current
      )
        return;

      if (result.ok) {
        setConversations(result.data.slice(0, 8));
        setHasLoadedConversations(true);
      } else {
        setConversationError(result.error);
      }
    } catch (caught) {
      if (
        requestId === conversationRequestIdRef.current &&
        currentProfileId === profileIdRef.current
      ) {
        setConversationError({
          code: "unknown",
          message:
            caught instanceof Error
              ? caught.message
              : text("تعذر تحميل المحادثات.", "Could not load conversations."),
          operation: "activity_conversations_load",
        });
      }
    } finally {
      if (
        requestId === conversationRequestIdRef.current &&
        currentProfileId === profileIdRef.current
      )
        setConversationsLoading(false);
    }
  }, [profileId, text]);

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId) {
      notificationRequestIdRef.current += 1;
      conversationRequestIdRef.current += 1;
      setNotifications([]);
      setConversations([]);
      setNotificationsLoading(false);
      setConversationsLoading(false);
      setHasLoadedNotifications(false);
      setHasLoadedConversations(false);
      setNotificationError(null);
      setConversationError(null);
      setLoadedProfileId(null);
      return;
    }

    notificationRequestIdRef.current += 1;
    conversationRequestIdRef.current += 1;
    setNotifications([]);
    setConversations([]);
    setNotificationsLoading(false);
    setConversationsLoading(false);
    setHasLoadedNotifications(false);
    setHasLoadedConversations(false);
    setNotificationError(null);
    setConversationError(null);
    setLoadedProfileId(null);
    void Promise.all([loadNotifications(), loadConversations()]);

    return () => {
      notificationRequestIdRef.current += 1;
      conversationRequestIdRef.current += 1;
    };
  }, [auth.status, loadConversations, loadNotifications, profileId]);

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
        <main className="rawaj-communication-v2 rawaj-account-activity-v3 container-wide rawaj-content-stack mobile-page-bottom pt-4">
          <CommunicationSignedOut returnTo="/activity" />
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader title={text("مركز النشاط", "Activity center")} to="/more" backMode="history" />
      <main className="rawaj-communication-v2 rawaj-communication-v2--activity rawaj-account-activity-v3 container-wide rawaj-content-stack mobile-page-bottom pt-4">
        <CommunicationCenterHero
          mode="activity"
          unreadMessages={counts.messages}
          unreadNotifications={counts.notifications}
        />
        <div
          className="rawaj-activity-tabs"
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

        {activeTab === "notifications" ? (
          <section className="rawaj-activity-panel" role="tabpanel">
            <ActivitySectionHeader
              title={text("آخر الإشعارات", "Latest notifications")}
              to="/notifications"
              action={text("عرض الكل", "View all")}
            />
            {notificationsLoading && !hasLoadedNotifications ? (
              <ActivityState>{text("جارٍ تحميل النشاط.", "Loading activity.")}</ActivityState>
            ) : notificationError && !hasLoadedNotifications ? (
              <ActivityRecovery
                message={notificationError.message}
                actionLabel={text("إعادة المحاولة", "Try again")}
                onRetry={() => void loadNotifications()}
                disabled={notificationsLoading}
              />
            ) : (
              <>
                {notificationError ? (
                  <ActivityRecovery
                    message={notificationError.message}
                    actionLabel={text("إعادة المحاولة", "Try again")}
                    onRetry={() => void loadNotifications()}
                    disabled={notificationsLoading}
                  />
                ) : null}
                {loadedProfileId !== profileId || notifications.length === 0 ? (
                  <ActivityState>
                    {text("لا توجد إشعارات محفوظة حاليًا.", "No saved notifications right now.")}
                  </ActivityState>
                ) : (
                  <div className="rawaj-activity-feed">
                    {notifications.map((notification) => (
                      <Link
                        key={notification.id}
                        to="/notifications"
                        search={{ open: notification.id }}
                        className="rawaj-notification-timeline"
                        data-read={Boolean(notification.readAt)}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notification.readAt ? "bg-border" : "bg-gold"}`}
                            aria-hidden="true"
                          />
                          <div className="min-w-0 flex-1">
                            <h2 className="text-sm font-bold">
                              {language === "en"
                                ? notification.titleEn || notification.titleAr
                                : notification.titleAr}
                            </h2>
                            {(
                              language === "en"
                                ? notification.bodyEn || notification.bodyAr
                                : notification.bodyAr
                            ) ? (
                              <p className="mt-1 line-clamp-2 text-xs leading-6 text-muted-foreground">
                                {language === "en"
                                  ? notification.bodyEn || notification.bodyAr
                                  : notification.bodyAr}
                              </p>
                            ) : null}
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {formatDateTime(notification.createdAt, language)}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        ) : (
          <section className="rawaj-activity-panel" role="tabpanel">
            <ActivitySectionHeader
              title={text("آخر المحادثات", "Latest conversations")}
              to="/chats"
              action={text("فتح الرسائل", "Open messages")}
            />
            {conversationsLoading && !hasLoadedConversations ? (
              <ActivityState>{text("جارٍ تحميل النشاط.", "Loading activity.")}</ActivityState>
            ) : conversationError && !hasLoadedConversations ? (
              <ActivityRecovery
                message={conversationError.message}
                actionLabel={text("إعادة المحاولة", "Try again")}
                onRetry={() => void loadConversations()}
                disabled={conversationsLoading}
              />
            ) : (
              <>
                {conversationError ? (
                  <ActivityRecovery
                    message={conversationError.message}
                    actionLabel={text("إعادة المحاولة", "Try again")}
                    onRetry={() => void loadConversations()}
                    disabled={conversationsLoading}
                  />
                ) : null}
                {conversations.length === 0 ? (
                  <ActivityState>
                    {text("لا توجد محادثات بعد.", "No conversations yet.")}
                  </ActivityState>
                ) : (
                  <div className="rawaj-activity-feed">
                    {conversations.map((conversation) => (
                      <Link
                        key={conversation.id}
                        to="/chats"
                        search={{ conversation: conversation.id }}
                        className="rawaj-activity-conversation"
                      >
                        <ParticipantAvatar
                          name={conversation.otherParticipant.displayName}
                          url={conversation.otherParticipant.avatarUrl}
                        />
                        <span className="rawaj-activity-conversation__copy">
                          <strong className="block truncate text-sm">
                            {conversation.otherParticipant.displayName}
                          </strong>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {conversation.lastMessagePreview || conversation.listingTitle}
                          </span>
                        </span>
                        {conversation.unreadCount > 0 ? (
                          <b>{formatUnreadBadge(conversation.unreadCount)}</b>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                )}
              </>
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
    <button type="button" role="tab" aria-selected={active} onClick={onClick}>
      <Icon className="h-4 w-4" />
      {label}
      {count > 0 ? <b>{formatUnreadBadge(count)}</b> : null}
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
  return <p className="rawaj-communication-state">{children}</p>;
}

function ActivityRecovery({
  message,
  actionLabel,
  onRetry,
  disabled,
}: {
  message: string;
  actionLabel: string;
  onRetry: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rawaj-communication-state space-y-3">
      <p>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={disabled}
        className="inline-flex min-h-11 items-center rounded-xl bg-card px-4 py-2 text-xs font-bold text-foreground hairline disabled:opacity-60"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function formatDateTime(value: string, language: "ar" | "en") {
  return new Intl.DateTimeFormat(marketLocale(language), {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatUnreadBadge(count: number) {
  return count > 99 ? "99+" : String(count);
}
