import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Ban,
  Flag,
  MessageCircle,
  MoreVertical,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import {
  CommunicationSearch,
  CommunicationSignedOut,
  ConversationSummaryItem,
} from "@/features/communication/CommunicationExperience";
import {
  blockConversationParticipant,
  createMessageReport,
  fetchConversationMessages,
  fetchMyConversations,
  markConversationRead,
  sendConversationMessage,
} from "@/lib/classifieds-api";
import type { ClassifiedsError, Conversation, ConversationMessage } from "@/lib/classifieds-types";
import { resolveConversationTarget } from "@/lib/journey-target-resolution";
import { emitUnreadActivityChanged } from "@/lib/unread-activity-events";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";
import { useConversationActivityRealtime, useOnlinePresence } from "@/lib/use-online-presence";

const chatsSearchSchema = z.object({
  conversation: z.string().optional(),
});

const quickReplies = [
  { ar: "هل الإعلان ما زال متوفراً؟", en: "Is this listing still available?" },
  { ar: "ما السعر النهائي؟", en: "What is your final price?" },
  { ar: "هل يمكن المعاينة قبل الشراء؟", en: "Can I inspect it before buying?" },
  { ar: "متى يناسبك التواصل؟", en: "When is a good time to talk?" },
] as const;

export const Route = createFileRoute("/chats")({
  validateSearch: chatsSearchSchema,
  head: () => ({
    meta: [{ title: "المحادثات | رواج" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: ChatsPage,
});

function ChatsPage() {
  const auth = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { language, text } = useUiPreferences();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [conversationError, setConversationError] = useState<ClassifiedsError | null>(null);
  const [messageError, setMessageError] = useState<ClassifiedsError | null>(null);
  const [body, setBody] = useState("");
  const [conversationQuery, setConversationQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesRequestIdRef = useRef(0);
  const conversationsRequestIdRef = useRef(0);
  const selectedConversationIdRef = useRef<string | null>(null);

  const targetResolution = useMemo(
    () => resolveConversationTarget(conversations, search.conversation),
    [conversations, search.conversation],
  );
  const selectedConversation =
    targetResolution.kind === "selected" || (isDesktop && targetResolution.kind === "default")
      ? targetResolution.conversation
      : null;
  const missingConversationTarget = targetResolution.kind === "missing";
  const mobileThreadOpen = !isDesktop && targetResolution.kind === "selected";
  const totalUnread = conversations.reduce(
    (total, conversation) => total + Math.max(0, conversation.unreadCount),
    0,
  );
  const filteredConversations = useMemo(() => {
    const query = conversationQuery.trim().toLocaleLowerCase(language === "ar" ? "ar" : "en");
    if (!query) return conversations;
    return conversations.filter((conversation) =>
      [
        conversation.otherParticipant.displayName,
        conversation.listingTitle,
        conversation.lastMessagePreview ?? "",
      ].some((value) => value.toLocaleLowerCase(language === "ar" ? "ar" : "en").includes(query)),
    );
  }, [conversationQuery, conversations, language]);
  const { onlineUserIds } = useOnlinePresence(auth.profile?.id, auth.status === "signedIn");

  useConversationActivityRealtime({
    userId: auth.profile?.id ?? null,
    enabled: auth.status === "signedIn",
    onMessage: (message) => {
      const currentUserId = auth.profile?.id;
      const currentConversationId = selectedConversationIdRef.current;
      const currentThreadVisible =
        currentConversationId === message.conversationId && document.visibilityState === "visible";

      if (currentConversationId === message.conversationId) {
        setMessages((current) =>
          current.some((item) => item.id === message.id) ? current : [...current, message],
        );
      }

      if (currentUserId && message.senderUserId !== currentUserId && currentThreadVisible) {
        void markConversationRead(currentUserId, message.conversationId).then(() => {
          setConversations((current) =>
            current.map((conversation) =>
              conversation.id === message.conversationId
                ? { ...conversation, unreadCount: 0 }
                : conversation,
            ),
          );
        });
      }

      emitUnreadActivityChanged();
      void loadConversations();
    },
  });

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversation?.id ?? null;
    setActionsOpen(false);
    setNotice("");
  }, [selectedConversation?.id]);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mql.matches);
    const handler = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.chatThreadOpen = mobileThreadOpen ? "true" : "false";
    return () => {
      delete document.documentElement.dataset.chatThreadOpen;
    };
  }, [mobileThreadOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      block: "end",
      behavior: loadingMessages ? "auto" : "smooth",
    });
  }, [loadingMessages, messages.length, selectedConversation?.id]);

  async function loadConversations() {
    const profileId = auth.profile?.id ?? null;
    if (!profileId) return;
    const requestId = ++conversationsRequestIdRef.current;
    setLoadingConversations(true);
    setConversationError(null);
    const result = await fetchMyConversations(profileId);
    if (requestId !== conversationsRequestIdRef.current || profileId !== auth.profile?.id) return;
    if (result.ok) {
      setConversations(result.data);
    } else {
      setConversations([]);
      setConversationError(result.error);
    }
    setLoadingConversations(false);
  }

  async function loadMessages(conversationId: string) {
    const profileId = auth.profile?.id ?? null;
    if (!profileId) return;
    const requestId = ++messagesRequestIdRef.current;
    setLoadingMessages(true);
    setMessageError(null);
    const result = await fetchConversationMessages(profileId, conversationId);
    if (requestId !== messagesRequestIdRef.current) return;
    if (result.ok) {
      setMessages(result.data);
      const markResult = await markConversationRead(profileId, conversationId);
      if (requestId !== messagesRequestIdRef.current) return;
      if (!markResult.ok) {
        setNotice(markResult.error.message);
      } else {
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation,
          ),
        );
        emitUnreadActivityChanged();
      }
    } else {
      setMessages([]);
      setMessageError(result.error);
    }
    setLoadingMessages(false);
  }

  useEffect(() => {
    if (auth.status !== "signedIn") {
      conversationsRequestIdRef.current += 1;
      messagesRequestIdRef.current += 1;
      setConversations([]);
      setMessages([]);
      setLoadingConversations(false);
      setLoadingMessages(false);
      return;
    }
    void loadConversations();
  }, [auth.status, auth.profile?.id]);

  useEffect(() => {
    if (auth.status !== "signedIn" || !selectedConversation) {
      messagesRequestIdRef.current += 1;
      setMessages([]);
      setMessageError(null);
      setLoadingMessages(false);
      return;
    }
    void loadMessages(selectedConversation.id);
  }, [auth.status, selectedConversation?.id]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.profile?.id || !selectedConversation || sending) return;
    if (selectedConversation.status !== "active") {
      setNotice(
        text(
          "هذه المحادثة محفوظة كسجل ولا تقبل رسائل جديدة.",
          "This conversation is preserved as history and cannot receive new messages.",
        ),
      );
      return;
    }
    const profileId = auth.profile.id;
    const conversationId = selectedConversation.id;
    const cleanBody = body.trim();
    if (!cleanBody) return;
    setNotice("");
    setMessageError(null);
    setSending(true);
    const result = await sendConversationMessage(profileId, conversationId, cleanBody);
    setSending(false);
    if (selectedConversationIdRef.current !== conversationId || auth.profile?.id !== profileId) return;
    if (!result.ok) {
      setMessageError(result.error);
      return;
    }
    setBody("");
    setMessages((current) =>
      current.some((message) => message.id === result.data.id) ? current : [...current, result.data],
    );
    await loadConversations();
  }

  async function handleReport(message: ConversationMessage) {
    if (!auth.profile?.id || !selectedConversation) return;
    setReportingMessageId(message.id);
    setNotice("");
    const result = await createMessageReport({
      messageId: message.id,
      conversationId: selectedConversation.id,
      reporterUserId: auth.profile.id,
      reason: "abusive_or_suspicious",
    });
    setReportingMessageId(null);
    setNotice(
      result.ok
        ? text("تم إرسال بلاغ الرسالة للمراجعة.", "Message report sent for review.")
        : result.error.message,
    );
  }

  async function handleBlock() {
    if (!auth.profile?.id || !selectedConversation) return;
    if (!confirm(text("حظر هذا المستخدم في هذه المحادثة؟", "Block this user?"))) return;
    setNotice("");
    const result = await blockConversationParticipant({
      conversationId: selectedConversation.id,
      blockerUserId: auth.profile.id,
      blockedUserId: selectedConversation.otherParticipant.userId,
      reason: null,
    });
    setNotice(
      result.ok
        ? text("تم حظر المحادثة. لن تقبل رسائل جديدة.", "Conversation blocked.")
        : result.error.message,
    );
    setActionsOpen(false);
    if (result.ok) await loadConversations();
  }

  function openConversation(conversationId: string) {
    void navigate({
      to: "/chats",
      search: { conversation: conversationId },
    });
  }

  function returnToConversationList() {
    void navigate({
      to: "/chats",
      search: {},
      replace: true,
    });
  }

  if (auth.status === "loading") {
    return (
      <div className="rawaj-chat-screen" data-view="list">
        <PageHeader title={text("المحادثات", "Messages")} back={false} />
        <main className="container-wide mobile-page-bottom pt-3">
          <ChatState
            loading
            title={text("جارٍ تجهيز محادثاتك", "Preparing your messages")}
            description={text(
              "نستعيد جلسة حسابك وقائمة المحادثات بأمان.",
              "Restoring your account session and conversations securely.",
            )}
          />
        </main>
      </div>
    );
  }

  if (auth.status !== "signedIn") {
    return (
      <div className="rawaj-chat-screen" data-view="list">
        <PageHeader title={text("المحادثات", "Messages")} back={false} />
        <main className="container-wide mobile-page-bottom pt-3">
          <CommunicationSignedOut returnTo="/chats" />
        </main>
      </div>
    );
  }

  return (
    <div className="rawaj-chat-screen" data-view={mobileThreadOpen ? "thread" : "list"}>
      {!mobileThreadOpen ? <PageHeader title={text("المحادثات", "Messages")} back={false} /> : null}

      <main
        className={`rawaj-chat-app container-wide ${
          mobileThreadOpen ? "rawaj-chat-app--thread" : "mobile-page-bottom"
        }`}
      >
        <div className="rawaj-chat-layout">
          {!mobileThreadOpen ? (
            <aside className="rawaj-chat-inbox" aria-label={text("قائمة المحادثات", "Conversation list")}>
              <header className="rawaj-chat-inbox__header">
                <div>
                  <span>{text("صندوق الرسائل", "Inbox")}</span>
                  <h1>{text("محادثاتك", "Your conversations")}</h1>
                  <p>
                    {totalUnread > 0
                      ? text(
                          `${totalUnread} رسالة بانتظارك`,
                          `${totalUnread} unread messages`,
                        )
                      : text("كل رسائلك مقروءة", "You are all caught up")}
                  </p>
                </div>
                <div className="rawaj-chat-inbox__count" data-has-unread={totalUnread > 0}>
                  <MessageCircle aria-hidden="true" />
                  <strong>{conversations.length}</strong>
                </div>
              </header>

              <CommunicationSearch
                value={conversationQuery}
                onChange={setConversationQuery}
                placeholder={text("ابحث عن شخص أو إعلان", "Search people or listings")}
                label={text("بحث في المحادثات", "Search conversations")}
              />

              <div className="rawaj-chat-inbox__body">
                {loadingConversations && conversations.length === 0 ? (
                  <ChatState
                    loading
                    title={text("جاري تحميل المحادثات", "Loading conversations")}
                    description={text("لحظات ونرتب أحدث الرسائل.", "Preparing your latest messages.")}
                  />
                ) : conversationError ? (
                  <ChatState
                    error
                    title={text("تعذر تحميل المحادثات", "Could not load conversations")}
                    description={conversationError.message}
                    actionLabel={text("إعادة المحاولة", "Try again")}
                    onAction={() => void loadConversations()}
                  />
                ) : conversations.length === 0 ? (
                  <ChatState
                    title={text("لا توجد محادثات بعد", "No conversations yet")}
                    description={text(
                      "افتح أي إعلان واضغط مراسلة البائع، وستظهر المحادثة هنا مباشرة.",
                      "Open a listing and message the seller. The conversation will appear here.",
                    )}
                    actionLabel={text("تصفح الإعلانات", "Browse listings")}
                    actionTo="/listings"
                  />
                ) : filteredConversations.length === 0 ? (
                  <ChatState
                    search
                    title={text("لا توجد نتيجة", "No results")}
                    description={text(
                      "جرّب اسمًا آخر أو كلمة من عنوان الإعلان.",
                      "Try another name or a word from the listing title.",
                    )}
                  />
                ) : (
                  <div className="rawaj-conversation-list">
                    {filteredConversations.map((conversation) => (
                      <ConversationSummaryItem
                        key={conversation.id}
                        conversation={conversation}
                        selected={selectedConversation?.id === conversation.id}
                        online={onlineUserIds.has(conversation.otherParticipant.userId)}
                        onSelect={() => openConversation(conversation.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </aside>
          ) : null}

          {(isDesktop || mobileThreadOpen || missingConversationTarget) && (
            <section className="rawaj-chat-thread" aria-label={text("المحادثة", "Conversation")}>
              {missingConversationTarget ? (
                <ChatState
                  error
                  title={text("المحادثة غير متاحة", "Conversation unavailable")}
                  description={text(
                    "قد تكون المحادثة حُذفت أو لا تتبع هذا الحساب.",
                    "This conversation may have been removed or does not belong to this account.",
                  )}
                  actionLabel={text("العودة للمحادثات", "Back to conversations")}
                  onAction={returnToConversationList}
                />
              ) : !selectedConversation ? (
                <div className="rawaj-chat-thread__placeholder">
                  <span>
                    <MessageCircle aria-hidden="true" />
                  </span>
                  <h2>{text("اختر محادثة", "Choose a conversation")}</h2>
                  <p>{text("ستظهر الرسائل هنا.", "Messages will appear here.")}</p>
                </div>
              ) : (
                <>
                  <header className="rawaj-chat-thread__header">
                    <button
                      type="button"
                      onClick={returnToConversationList}
                      className="rawaj-chat-thread__back lg:hidden"
                      aria-label={text("العودة إلى المحادثات", "Back to conversations")}
                    >
                      <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
                    </button>

                    <ChatAvatar
                      name={selectedConversation.otherParticipant.displayName}
                      url={selectedConversation.otherParticipant.avatarUrl}
                      online={onlineUserIds.has(selectedConversation.otherParticipant.userId)}
                    />

                    <div className="rawaj-chat-thread__identity">
                      <h2>{selectedConversation.otherParticipant.displayName}</h2>
                      <span
                        className="rawaj-chat-thread__presence"
                        data-online={onlineUserIds.has(selectedConversation.otherParticipant.userId)}
                      >
                        <i aria-hidden="true" />
                        {onlineUserIds.has(selectedConversation.otherParticipant.userId)
                          ? text("متصل الآن", "Online now")
                          : text("غير متصل", "Offline")}
                      </span>
                    </div>

                    <div className="rawaj-chat-thread__actions">
                      <button
                        type="button"
                        onClick={() => setActionsOpen((current) => !current)}
                        aria-label={text("خيارات المحادثة", "Conversation options")}
                        aria-expanded={actionsOpen}
                      >
                        <MoreVertical aria-hidden="true" />
                      </button>
                      {actionsOpen ? (
                        <div role="menu">
                          <button type="button" role="menuitem" onClick={() => void handleBlock()}>
                            <Ban aria-hidden="true" />
                            {text("حظر المستخدم", "Block user")}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </header>

                  <div className="rawaj-chat-thread__listing">
                    <span>{text("حول الإعلان", "About listing")}</span>
                    {selectedConversation.listingId ? (
                      <Link to="/listings/$id" params={{ id: selectedConversation.listingId }}>
                        {selectedConversation.listingTitle}
                      </Link>
                    ) : (
                      <strong>{selectedConversation.listingTitle}</strong>
                    )}
                  </div>

                  {selectedConversation.status !== "active" ? (
                    <div className="rawaj-chat-thread__status" data-status={selectedConversation.status}>
                      {selectedConversation.status === "blocked"
                        ? text("هذه المحادثة محظورة ولا تقبل رسائل جديدة.", "This conversation is blocked.")
                        : text(
                            "الإعلان لم يعد متاحًا، لكن المحادثة محفوظة كسجل.",
                            "The listing is unavailable, but the conversation is preserved.",
                          )}
                    </div>
                  ) : null}

                  <div className="rawaj-chat-messages">
                    {loadingMessages ? (
                      <PanelText loading>{text("جاري تحميل الرسائل", "Loading messages")}</PanelText>
                    ) : messageError ? (
                      <PanelText error>{messageError.message}</PanelText>
                    ) : messages.length === 0 ? (
                      <div className="rawaj-chat-messages__empty">
                        <MessageCircle aria-hidden="true" />
                        <strong>{text("ابدأ المحادثة", "Start the conversation")}</strong>
                        <p>{text("اكتب أول رسالة بوضوح واحترام.", "Write the first message clearly.")}</p>
                      </div>
                    ) : (
                      messages.map((message) => {
                        const mine = message.senderUserId === auth.profile?.id;
                        return (
                          <article key={message.id} className="rawaj-message-bubble" data-mine={mine}>
                            <p className="whitespace-pre-line break-words">{message.body}</p>
                            <div className="rawaj-message-bubble__meta">
                              <time>{formatDateTime(message.createdAt, language)}</time>
                              {!mine ? (
                                <button
                                  type="button"
                                  disabled={reportingMessageId === message.id}
                                  onClick={() => void handleReport(message)}
                                  aria-label={text("إبلاغ عن الرسالة", "Report message")}
                                >
                                  <Flag aria-hidden="true" />
                                  {reportingMessageId === message.id
                                    ? text("جارٍ الإبلاغ", "Reporting")
                                    : text("إبلاغ", "Report")}
                                </button>
                              ) : null}
                            </div>
                          </article>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} aria-hidden="true" />
                  </div>

                  <form onSubmit={(event) => void handleSend(event)} className="rawaj-chat-composer">
                    {selectedConversation.status === "active" ? (
                      <div className="rawaj-chat-quick-replies">
                        {quickReplies.map((reply) => (
                          <button
                            key={reply.en}
                            type="button"
                            onClick={() => setBody(language === "ar" ? reply.ar : reply.en)}
                          >
                            {language === "ar" ? reply.ar : reply.en}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <div className="rawaj-chat-composer__row">
                      <textarea
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                        maxLength={2000}
                        rows={1}
                        placeholder={text("اكتب رسالة...", "Write a message...")}
                        aria-label={text("اكتب رسالة", "Write a message")}
                      />
                      <button
                        type="submit"
                        disabled={
                          sending ||
                          body.trim().length === 0 ||
                          selectedConversation.status !== "active"
                        }
                        aria-label={sending ? text("جاري الإرسال", "Sending") : text("إرسال", "Send")}
                      >
                        {sending ? (
                          <RefreshCw className="animate-spin" aria-hidden="true" />
                        ) : (
                          <Send aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    {notice ? <p className="rawaj-chat-composer__notice">{notice}</p> : null}
                  </form>
                </>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

function ChatState({
  title,
  description,
  loading = false,
  error = false,
  search = false,
  actionLabel,
  actionTo,
  onAction,
}: {
  title: string;
  description: string;
  loading?: boolean;
  error?: boolean;
  search?: boolean;
  actionLabel?: string;
  actionTo?: "/listings";
  onAction?: () => void;
}) {
  const Icon = loading ? RefreshCw : search ? Search : MessageCircle;
  return (
    <div className="rawaj-chat-state" data-tone={error ? "error" : "neutral"}>
      <span>
        <Icon className={loading ? "animate-spin" : ""} aria-hidden="true" />
      </span>
      <strong>{title}</strong>
      <p>{description}</p>
      {actionLabel && actionTo ? <Link to={actionTo}>{actionLabel}</Link> : null}
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function ChatAvatar({
  name,
  url,
  online,
}: {
  name: string;
  url: string | null;
  online: boolean;
}) {
  return (
    <span className="rawaj-chat-avatar" data-online={online}>
      {url ? <img src={url} alt={name} loading="lazy" decoding="async" /> : name.slice(0, 1)}
      <i aria-hidden="true" />
    </span>
  );
}

function PanelText({
  children,
  loading = false,
  error = false,
}: {
  children: string;
  loading?: boolean;
  error?: boolean;
}) {
  return (
    <div className="rawaj-chat-panel-text" data-error={error}>
      {loading ? <RefreshCw className="animate-spin" aria-hidden="true" /> : null}
      <span>{children}</span>
    </div>
  );
}

function formatDateTime(value: string, language: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
