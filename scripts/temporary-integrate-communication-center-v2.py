from pathlib import Path


def replace_exact(value: str, old: str, new: str, label: str) -> str:
    if old not in value:
        raise RuntimeError(f"Missing {label}")
    return value.replace(old, new, 1)


# Root stylesheet.
p = Path("src/routes/__root.tsx")
s = p.read_text()
s = replace_exact(
    s,
    'import messagingSignatureCss from "../messaging-signature.css?url";',
    'import messagingSignatureCss from "../messaging-signature.css?url";\nimport communicationCenterV2Css from "../communication-center-v2.css?url";',
    "communication css import",
)
s = replace_exact(
    s,
    '        { rel: "stylesheet", href: messagingSignatureCss },',
    '        { rel: "stylesheet", href: messagingSignatureCss },\n        { rel: "stylesheet", href: communicationCenterV2Css },',
    "communication css link",
)
p.write_text(s)

# Chats.
p = Path("src/routes/chats.tsx")
s = p.read_text()
s = replace_exact(
    s,
    'import { Ban, Flag, MessageCircle, Search, Send, ShieldAlert } from "lucide-react";',
    'import { Ban, Flag, MessageCircle, Send } from "lucide-react";',
    "chat icon imports",
)
s = replace_exact(
    s,
    'import { PageHeader } from "@/components/PageHeader";',
    '''import { PageHeader } from "@/components/PageHeader";
import {
  CommunicationCenterHero,
  CommunicationSafetyNote,
  CommunicationSearch,
  CommunicationSignedOut,
  ConversationSummaryItem,
} from "@/features/communication/CommunicationExperience";''',
    "chat communication imports",
)
s = replace_exact(
    s,
    '''        <main className="container-wide mobile-page-bottom pt-4">
          <StatePanel
            title={text("تسجيل الدخول مطلوب", "Login required")}
            body={text(
              "سجل الدخول لعرض محادثاتك الحقيقية مع البائعين والمشترين.",
              "Log in to view your real conversations with buyers and sellers.",
            )}
            actionTo="/login"
            actionSearch={{ returnTo: "/chats" }}
            actionLabel={text("تسجيل الدخول", "Log in")}
          />
        </main>''',
    '''        <main className="rawaj-communication-v2 container-wide mobile-page-bottom pt-4">
          <CommunicationSignedOut returnTo="/chats" />
        </main>''',
    "chat signed-out state",
)
s = replace_exact(
    s,
    '<main className="container-wide mobile-page-bottom space-y-4 pt-4">',
    '<main className="rawaj-communication-v2 rawaj-communication-v2--messages container-wide mobile-page-bottom space-y-4 pt-4">',
    "chat main class",
)
prefix_start = s.index('        <section className="rounded-2xl bg-card p-4 hairline shadow-soft">')
workspace_start = s.index('        <div className="grid min-h-[60dvh]', prefix_start)
prefix = '''        <CommunicationCenterHero
          mode="messages"
          unreadMessages={conversations.reduce((total, conversation) => total + conversation.unreadCount, 0)}
          conversationCount={conversations.length}
        />
        <CommunicationSafetyNote />

'''
s = s[:prefix_start] + prefix + s[workspace_start:]
s = replace_exact(
    s,
    '<div className="grid min-h-[60dvh] grid-cols-1 gap-3 lg:min-h-[560px] lg:grid-cols-[320px_1fr]">',
    '<div className="rawaj-message-workspace">',
    "message workspace",
)
s = replace_exact(
    s,
    '''className={`rounded-2xl bg-card p-3 hairline ${
              !isDesktop && viewingConversationOnMobile ? "hidden" : ""
            }`}''',
    '''className={`rawaj-conversation-sidebar ${
              !isDesktop && viewingConversationOnMobile ? "hidden" : ""
            }`}''',
    "conversation sidebar",
)
s = replace_exact(
    s,
    '''            <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold">
              <MessageCircle className="h-4 w-4 text-primary" />
              {text("قائمة المحادثات", "Conversation list")}
            </h2>
            <label className="relative mb-3 block">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={conversationQuery}
                onChange={(event) => setConversationQuery(event.target.value)}
                placeholder={text("ابحث باسم أو إعلان أو رسالة", "Search conversations")}
                aria-label={text("بحث في المحادثات", "Search conversations")}
                className="min-h-11 w-full rounded-xl bg-muted-surface ps-10 pe-3 py-2 text-xs outline-none hairline"
              />
            </label>''',
    '''            <div className="rawaj-conversation-sidebar__heading">
              <h2><MessageCircle aria-hidden="true" />{text("المحادثات", "Conversations")}</h2>
              <span>{filteredConversations.length}</span>
            </div>
            <CommunicationSearch
              value={conversationQuery}
              onChange={setConversationQuery}
              placeholder={text("ابحث باسم أو إعلان أو رسالة", "Search conversations")}
              label={text("بحث في المحادثات", "Search conversations")}
            />''',
    "conversation search",
)
map_start = s.index('                {filteredConversations.map((conversation) => (')
map_end = s.index('                ))}', map_start) + len('                ))}')
map_replacement = '''                {filteredConversations.map((conversation) => (
                  <ConversationSummaryItem
                    key={conversation.id}
                    conversation={conversation}
                    selected={selectedConversation?.id === conversation.id}
                    onSelect={() => {
                      if (!isDesktop) setViewingConversationOnMobile(true);
                      void navigate({
                        to: "/chats",
                        search: { conversation: conversation.id },
                      });
                    }}
                  />
                ))}'''
s = s[:map_start] + map_replacement + s[map_end:]
s = s.replace('<div className="space-y-2">', '<div className="rawaj-conversation-list">', 1)
s = replace_exact(
    s,
    '''className={`flex min-h-[60dvh] flex-col rounded-2xl bg-card hairline lg:min-h-[560px] ${
              !isDesktop && !viewingConversationOnMobile && !missingConversationTarget
                ? "hidden"
                : ""
            }`}''',
    '''className={`rawaj-message-panel ${
              !isDesktop && !viewingConversationOnMobile && !missingConversationTarget
                ? "hidden"
                : ""
            }`}''',
    "message panel",
)
s = replace_exact(s, '<header className="border-b border-border p-4">', '<header className="rawaj-message-header">', "message header")
s = replace_exact(s, '<div className="flex items-center gap-3">', '<div className="rawaj-message-header__row">', "message header row")
s = replace_exact(s, '<div className="min-w-0 flex-1">', '<div className="rawaj-message-header__copy">', "message header copy")
s = replace_exact(s, '<div className="flex-1 space-y-2 overflow-y-auto p-4">', '<div className="rawaj-message-stream">', "message stream")
s = replace_exact(
    s,
    '''className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-6 ${
                            mine
                              ? "ms-auto bg-primary text-primary-foreground"
                              : "me-auto bg-muted-surface text-foreground"
                          }`}''',
    'className="rawaj-message-bubble" data-mine={mine}',
    "message bubble",
)
s = s.replace('className="mt-1 text-[10px] opacity-70"', 'className="rawaj-message-bubble__time"')
s = s.replace('className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold opacity-80"', 'className="rawaj-message-bubble__report"')
s = replace_exact(s, 'className="border-t border-border p-3"', 'className="rawaj-message-composer"', "message composer")
s = replace_exact(s, 'className="mb-2 w-full rounded-xl bg-muted-surface px-3 py-2 text-xs outline-none hairline"', 'className="rawaj-message-composer__block-reason mb-2"', "block reason")
s = s.replace('className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"', 'className="rawaj-quick-replies"')
s = s.replace('className="min-h-11 shrink-0 rounded-xl bg-muted-surface px-3 py-2 text-[11px] font-bold text-foreground hairline"', '')
s = replace_exact(s, 'className="min-h-12 rounded-xl bg-muted-surface px-3 py-2 text-sm outline-none hairline"', '', "message textarea")
s = replace_exact(s, 'className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"', 'className="rawaj-message-composer__send"', "send button")
state_start = s.index('function StatePanel(')
format_start = s.index('function formatDateTime', state_start)
s = s[:state_start] + s[format_start:]
p.write_text(s)

# Notifications.
p = Path("src/routes/notifications.tsx")
s = p.read_text()
s = replace_exact(
    s,
    '''import {
  Bell,
  Bookmark,
  CheckCheck,
  Heart,
  LogIn,
  MessageCircle,
  ScrollText,
  Sparkles,
} from "lucide-react";''',
    '''import {
  Bookmark,
  CheckCheck,
  Heart,
  MessageCircle,
  ScrollText,
  Sparkles,
} from "lucide-react";''',
    "notification icons",
)
s = replace_exact(
    s,
    'import { PageHeader } from "@/components/PageHeader";',
    '''import { PageHeader } from "@/components/PageHeader";
import {
  CommunicationCenterHero,
  CommunicationSectionHeader,
  CommunicationSignedOut,
  NotificationTimelineItem,
} from "@/features/communication/CommunicationExperience";''',
    "notification communication imports",
)
s = replace_exact(
    s,
    '<main className="container-wide mobile-page-bottom space-y-5 pt-4">',
    '<main className="rawaj-communication-v2 rawaj-communication-v2--notifications container-wide mobile-page-bottom space-y-5 pt-4">',
    "notification main",
)
s = replace_exact(
    s,
    '''          <section className="rounded-2xl bg-card p-8 text-center shadow-soft hairline">
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
              search={{ returnTo: "/notifications" }}
              className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              {text("تسجيل الدخول", "Log in")}
            </Link>
          </section>''',
    '<CommunicationSignedOut returnTo="/notifications" />',
    "notification signed-out",
)
s = replace_exact(
    s,
    '<section className="rounded-2xl bg-card p-4 shadow-soft hairline">',
    '<section className="space-y-4">',
    "notification signed-in wrapper",
)
header_start = s.index('            <div className="flex flex-wrap items-start justify-between gap-3">')
loading_start = s.index('            {loading ? (', header_start)
hero = '''            <CommunicationCenterHero
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
'''
s = s[:header_start] + hero + s[loading_start:]
list_start = s.index('<div className="mt-4 space-y-2">')
s = s[:list_start] + s[list_start:].replace('<div className="mt-4 space-y-2">', '<div className="rawaj-notification-list">', 1)
map_start = s.index('                {notifications.map((notification) => (')
map_end = s.index('                ))}', map_start) + len('                ))}')
map_replacement = '''                {notifications.map((notification) => (
                  <NotificationTimelineItem
                    key={notification.id}
                    notification={notification}
                    navigable={isNavigableNotification(notification)}
                    opening={openingTargetId === notification.id}
                    onOpen={() => void openNotificationTarget(notification)}
                    onMarkRead={() => void markOne(notification.id)}
                    dateLabel={formatNotificationDate(notification.createdAt, language)}
                  />
                ))}'''
s = s[:map_start] + map_replacement + s[map_end:]
# Close nested notification panel before signed-in wrapper closes.
preferences_marker = '        <NotificationPreferencesPanel />'
wrapper_close = s.rfind('          </section>\n        )}', 0, s.index(preferences_marker))
if wrapper_close < 0:
    raise RuntimeError("Missing notification wrapper close")
s = s[:wrapper_close] + '            </section>\n' + s[wrapper_close:]
s = s.replace('<NotificationPreferencesPanel />', '<div className="rawaj-notification-preferences"><NotificationPreferencesPanel /></div>', 1)
s = s.replace('<section className="rounded-2xl bg-card p-4 hairline">', '<section className="rawaj-communication-follow-up">', 1)
s = s.replace('<div className="mt-3 grid gap-2 sm:grid-cols-2">', '<div className="rawaj-communication-follow-up__grid">', 1)
p.write_text(s)

# Activity center.
p = Path("src/routes/activity.tsx")
s = p.read_text()
s = replace_exact(s, 'import { Bell, LogIn, MessageCircle } from "lucide-react";', 'import { Bell, MessageCircle } from "lucide-react";', "activity icons")
s = replace_exact(
    s,
    'import { PageHeader } from "@/components/PageHeader";',
    '''import { PageHeader } from "@/components/PageHeader";
import {
  CommunicationCenterHero,
  CommunicationSignedOut,
  ParticipantAvatar,
} from "@/features/communication/CommunicationExperience";''',
    "activity imports",
)
s = replace_exact(
    s,
    '''        <main className="container-wide mobile-page-bottom pt-4">
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
        </main>''',
    '''        <main className="rawaj-communication-v2 container-wide mobile-page-bottom pt-4">
          <CommunicationSignedOut returnTo="/activity" />
        </main>''',
    "activity signed out",
)
s = replace_exact(
    s,
    '<main className="container-wide mobile-page-bottom space-y-4 pt-4">',
    '<main className="rawaj-communication-v2 rawaj-communication-v2--activity container-wide mobile-page-bottom space-y-4 pt-4">',
    "activity main",
)
intro_start = s.index('        <section className="rounded-2xl bg-card p-4 hairline">')
intro_end = s.index('        </section>', intro_start) + len('        </section>')
intro = '''        <CommunicationCenterHero
          mode="activity"
          unreadMessages={counts.messages}
          unreadNotifications={counts.notifications}
        />
        <div className="rawaj-activity-tabs" role="tablist" aria-label={text("أقسام النشاط", "Activity sections")}>
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
        </div>'''
s = s[:intro_start] + intro + s[intro_end:]
s = s.replace('<section className="rounded-2xl bg-card p-4 hairline" role="tabpanel">', '<section className="rawaj-activity-panel" role="tabpanel">', 2)
s = s.replace('<div className="mt-3 space-y-2">', '<div className="rawaj-activity-feed">', 2)
s = s.replace('className={`rounded-xl p-3 hairline ${notification.readAt ? "bg-card" : "bg-muted-surface"}`}', 'className="rawaj-notification-timeline" data-read={Boolean(notification.readAt)}', 1)
s = s.replace('className="flex min-h-11 items-center gap-3 rounded-xl bg-muted-surface p-3 transition hover:bg-secondary hairline"', 'className="rawaj-activity-conversation"', 1)
old_avatar = '''                    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-card text-sm font-bold text-primary hairline">
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
                    </span>'''
s = replace_exact(
    s,
    old_avatar,
    '<ParticipantAvatar name={conversation.otherParticipant.displayName} url={conversation.otherParticipant.avatarUrl} />',
    "activity avatar",
)
s = s.replace('<span className="min-w-0 flex-1 text-start">', '<span className="rawaj-activity-conversation__copy">', 1)
s = s.replace('<span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-gold-foreground">', '<b>', 1)
s = s.replace('</span>\n                    ) : null}', '</b>\n                    ) : null}', 1)
s = replace_exact(
    s,
    '''      className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition hairline ${
        active ? "bg-primary text-primary-foreground" : "bg-muted-surface text-foreground"
      }`}''',
    '',
    "activity tab classes",
)
s = s.replace('<span className="rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold text-gold-foreground">', '<b>', 1)
s = s.replace('</span>\n      ) : null}', '</b>\n      ) : null}', 1)
s = s.replace('className="mt-3 rounded-xl bg-muted-surface p-4 text-center text-xs leading-6 text-muted-foreground hairline"', 'className="rawaj-communication-state"')
p.write_text(s)
