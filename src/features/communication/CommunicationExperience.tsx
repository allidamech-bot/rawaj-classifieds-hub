import { Link } from "@tanstack/react-router";
import {
  Bell,
  Check,
  ChevronLeft,
  Inbox,
  LockKeyhole,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Conversation, NotificationItem } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";

export function CommunicationCenterHero({
  mode,
  unreadMessages = 0,
  unreadNotifications = 0,
  conversationCount = 0,
  actions,
}: {
  mode: "activity" | "messages" | "notifications";
  unreadMessages?: number;
  unreadNotifications?: number;
  conversationCount?: number;
  actions?: ReactNode;
}) {
  const { text } = useUiPreferences();
  const title =
    mode === "messages"
      ? text("محادثات البيع والشراء", "Buyer and seller conversations")
      : mode === "notifications"
        ? text("كل ما يحتاج انتباهك", "Everything that needs your attention")
        : text("مركز نشاطك على رواج", "Your RAWAJ activity center");
  const description =
    mode === "messages"
      ? text(
          "تابع المحادثات المرتبطة بإعلانات حقيقية، وابحث عن الشخص أو الإعلان من مكان واحد.",
          "Follow conversations linked to real listings and search by person or listing from one place.",
        )
      : mode === "notifications"
        ? text(
            "راجع تنبيهات الحساب والإعلانات، افتح الهدف المرتبط، واضبط تفضيلات المتابعة.",
            "Review account and listing notifications, open linked targets, and manage follow-up preferences.",
          )
        : text(
            "نظرة سريعة على الرسائل والتنبيهات قبل الانتقال إلى التفاصيل الكاملة.",
            "A quick view of messages and notifications before opening the full details.",
          );
  const Heading = mode === "messages" ? "h2" : "h1";

  return (
    <section className="rawaj-communication-hero" data-mode={mode}>
      <div className="rawaj-communication-hero__copy">
        <p>
          <Sparkles aria-hidden="true" />
          {text("مركز التواصل", "Communication center")}
        </p>
        <Heading>{title}</Heading>
        <span>{description}</span>
      </div>
      <div className="rawaj-communication-hero__metrics">
        <CommunicationMetric
          icon={MessageCircle}
          value={unreadMessages}
          label={text("رسائل غير مقروءة", "Unread messages")}
        />
        <CommunicationMetric
          icon={Bell}
          value={unreadNotifications}
          label={text("تنبيهات غير مقروءة", "Unread notifications")}
        />
        {mode === "messages" ? (
          <CommunicationMetric
            icon={Inbox}
            value={conversationCount}
            label={text("محادثات محفوظة", "Saved conversations")}
          />
        ) : null}
      </div>
      <nav
        className="rawaj-communication-hero__actions"
        aria-label={text("روابط مركز التواصل", "Communication links")}
      >
        <Link to="/activity" search={{ tab: "notifications" }} data-active={mode === "activity"}>
          <Sparkles aria-hidden="true" />
          {text("النشاط", "Activity")}
        </Link>
        <Link to="/chats" search={{}} data-active={mode === "messages"}>
          <MessageCircle aria-hidden="true" />
          {text("الرسائل", "Messages")}
        </Link>
        <Link to="/notifications" data-active={mode === "notifications"}>
          <Bell aria-hidden="true" />
          {text("التنبيهات", "Notifications")}
        </Link>
        {actions}
      </nav>
    </section>
  );
}

function CommunicationMetric({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
}) {
  return (
    <div>
      <Icon aria-hidden="true" />
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function CommunicationSafetyNote() {
  const { text } = useUiPreferences();
  return (
    <aside className="rawaj-communication-safety">
      <ShieldCheck aria-hidden="true" />
      <div>
        <strong>{text("تواصل بأمان", "Communicate safely")}</strong>
        <p>
          {text(
            "اتفق على المعاينة في مكان عام، ولا تحول أي مبلغ قبل التحقق من الإعلان والطرف الآخر.",
            "Meet in a public place and do not transfer money before verifying the listing and the other party.",
          )}
        </p>
      </div>
    </aside>
  );
}

export function ConversationSummaryItem({
  conversation,
  selected,
  onSelect,
  dateLabel,
}: {
  conversation: Conversation;
  selected: boolean;
  onSelect: () => void;
  dateLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="rawaj-conversation-summary"
      data-selected={selected}
      aria-current={selected ? "true" : undefined}
    >
      <ParticipantAvatar
        name={conversation.otherParticipant.displayName}
        url={conversation.otherParticipant.avatarUrl}
      />
      <span className="rawaj-conversation-summary__copy">
        <strong>{conversation.otherParticipant.displayName}</strong>
        <small>{conversation.listingTitle}</small>
        {conversation.lastMessagePreview ? <p>{conversation.lastMessagePreview}</p> : null}
      </span>
      <span className="rawaj-conversation-summary__meta">
        {dateLabel ? <time>{dateLabel}</time> : null}
        {conversation.unreadCount > 0 ? (
          <b>{conversation.unreadCount}</b>
        ) : (
          <Check aria-hidden="true" />
        )}
      </span>
    </button>
  );
}

export function ParticipantAvatar({ name, url }: { name: string; url: string | null }) {
  return (
    <Avatar className="rawaj-participant-avatar">
      {url ? (
        <AvatarImage src={url} alt={name} loading="lazy" decoding="async" width={44} height={44} />
      ) : null}
      <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
    </Avatar>
  );
}

export function NotificationTimelineItem({
  notification,
  navigable,
  opening,
  onOpen,
  onMarkRead,
  dateLabel,
}: {
  notification: NotificationItem;
  navigable: boolean;
  opening: boolean;
  onOpen: () => void;
  onMarkRead: () => void;
  dateLabel: string;
}) {
  const { text } = useUiPreferences();
  const content = (
    <>
      <span className="rawaj-notification-timeline__icon">
        <Bell aria-hidden="true" />
      </span>
      <span className="rawaj-notification-timeline__copy">
        <strong>{notification.titleAr}</strong>
        {notification.bodyAr ? <p>{notification.bodyAr}</p> : null}
        <small>{opening ? text("جارٍ فتح الهدف...", "Opening target...") : dateLabel}</small>
      </span>
      {navigable ? (
        <ChevronLeft
          className="rawaj-notification-timeline__chevron rtl:rotate-180"
          aria-hidden="true"
        />
      ) : null}
    </>
  );

  return (
    <article className="rawaj-notification-timeline" data-read={Boolean(notification.readAt)}>
      {navigable ? (
        <button type="button" onClick={onOpen} disabled={opening}>
          {content}
        </button>
      ) : (
        <div>{content}</div>
      )}
      {!notification.readAt ? (
        <button type="button" className="rawaj-notification-timeline__read" onClick={onMarkRead}>
          <Check aria-hidden="true" />
          {text("تحديد كمقروء", "Mark read")}
        </button>
      ) : null}
    </article>
  );
}

export function CommunicationSearch({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <label className="rawaj-communication-search">
      <Search aria-hidden="true" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
    </label>
  );
}

export function CommunicationSectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="rawaj-communication-section-header">
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
        {description ? <span>{description}</span> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </header>
  );
}

export function CommunicationSignedOut({
  returnTo,
}: {
  returnTo: "/activity" | "/chats" | "/notifications";
}) {
  const { text } = useUiPreferences();
  return (
    <section className="rawaj-communication-signed-out">
      <span>
        <LockKeyhole aria-hidden="true" />
      </span>
      <h1>{text("تسجيل الدخول مطلوب", "Login required")}</h1>
      <p>
        {text(
          "سجّل الدخول لعرض الرسائل والتنبيهات الخاصة بحسابك فقط.",
          "Sign in to view messages and notifications that belong to your account.",
        )}
      </p>
      <Link to="/login" search={{ returnTo }}>
        {text("تسجيل الدخول", "Log in")}
      </Link>
      <Link to="/listings">
        <Store aria-hidden="true" />
        {text("تصفح الإعلانات", "Browse listings")}
      </Link>
    </section>
  );
}
