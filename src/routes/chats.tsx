import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Ban, Flag, MessageCircle, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import {
  CommunicationCenterHero,
  CommunicationSafetyNote,
  CommunicationSearch,
  CommunicationSignedOut,
  ConversationSummaryItem,
} from "@/features/communication/CommunicationExperience";
import { useLiveChatWorkspace } from "@/features/communication/useLiveChatWorkspace";
import {
  blockConversationParticipant,
  createMessageReport,
  fetchConversationMessages,
  fetchMyConversations,
  markConversationRead,
  sendConversationMessage,
} from "@/lib/classifieds-api";
import {
  completeMessageSendRequest,
  readOrCreateMessageSendRequestId,
} from "@/lib/api/message-send-request";
import type { ClassifiedsError, Conversation, ConversationMessage } from "@/lib/classifieds-types";
import { resolveConversationTarget } from "@/lib/journey-target-resolution";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

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
    meta: [{ title: "المحادثات | رواجا" }, { name: "robots", content: "noindex, nofollow" }],
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
  const [blockReason, setBlockReason] = useState("");
  const [viewingConversationOnMobile, setViewingConversationOnMobile] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const messagesRequestIdRef = useRef(0);
  const conversationsRequestIdRef = useRef(0);
  const selectedConversationIdRef = useRef<string | null>(null);
  const autoOpenedConversationRef = useRef<string | null>(null);

  const targetResolution = useMemo(
    () => resolveConversationTarget(conversations, search.conversation),
    [conversations, search.conversation],
  );
  const selectedConversation =
    targetResolution.kind === "selected" || targetResolution.kind === "default"
      ? targetResolution.conversation
      : null;
  const missingConversationTarget = targetResolution.kind === "missing";
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

  const isConversationPanelVisible = isDesktop || viewingConversationOnMobile;
  const liveConversationId =
    selectedConversation && isConversationPanelVisible ? selectedConversation.id : null;

  useLiveChatWorkspace({
    signedIn: auth.status === "signedIn",
    profileId: auth.profile?.id ?? null,
    selectedConversationId: liveConversationId,
    setConversations,
    setMessages,
  });

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversation?.id ?? null;
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (!selectedConversation && !missingConversationTarget) {
      setViewingConversationOnMobile(false);
    }
  }, [missingConversationTarget, selectedConversation]);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mql.matches);
    const handler = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    autoOpenedConversationRef.current = null;
  }, [search.conversation]);

  useEffect(() => {
    if (!isDesktop && search.conversation && conversations.length > 0) {
      const exists = conversations.some((conversation) => conversation.id === search.conversation);
      if (exists && autoOpenedConversationRef.current !== search.conversation) {
        autoOpenedConversationRef.current = search.conversation;
        setViewingConversationOnMobile(true);
      }
    }
  }, [isDesktop, search.conversation, conversations]);

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
      if (!search.conversation && result.data[0]) {
        void navigate({
          to: "/chats",
          search: { conversation: result.data[0].id },
          replace: true,
        });
      }
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
      if (!markResult.ok) setNotice(markResult.error.message);
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
    if (auth.status !== "signedIn" || !selectedConversation || !isConversationPanelVisible) {
      messagesRequestIdRef.current += 1;
      setMessages([]);
      setMessageError(null);
      setLoadingMessages(false);
      return;
    }
    void loadMessages(selectedConversation.id);
  }, [auth.status, isConversationPanelVisible, selectedConversation?.id]);

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
    const requestId = readOrCreateMessageSendRequestId(profileId, conversationId, cleanBody);
    setNotice("");
    setMessageError(null);
    setSending(true);
    const result = await sendConversationMessage(profileId, conversationId, cleanBody, requestId);
    setSending(false);
    if (selectedConversationIdRef.current !== conversationId || auth.profile?.id !== profileId)
      return;
    if (!result.ok) {
      setMessageError(result.error);
      return;
    }
    completeMessageSendRequest(profileId, conversationId, requestId);
    setBody("");
    setMessages((current) =>
      current.some((message) => message.id === result.data.id)
        ? current
        : [...current, result.data],
    );
    setNotice(text("تم إرسال الرسالة.", "Message sent."));
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
    if (
      !confirm(text("حظر هذا المستخدم في هذه المحادثة؟", "Block this user in this conversation?"))
    )
      return;
    setNotice("");
    const result = await blockConversationParticipant({
      conversationId: selectedConversation.id,
      blockerUserId: auth.profile.id,
      blockedUserId: selectedConversation.otherParticipant.userId,
      reason: blockReason || null,
    });
    setNotice(
      result.ok
        ? text(
            "تم حظر المحادثة. لن تقبل رسائل جديدة.",
            "Conversation blocked. New messages are no longer allowed.",
          )
        : result.error.message,
    );
    if (result.ok) await loadConversations();
  }

  function openFirstAvailableConversation() {
    const firstConversation = conversations[0];
    if (firstConversation) {
      if (!isDesktop) setViewingConversationOnMobile(true);
      void navigate({
        to: "/chats",
        search: { conversation: firstConversation.id },
        replace: true,
      });
      return;
    }
    void navigate({ to: "/chats", search: {}, replace: true });
  }

  if (auth.status !== "signedIn") {
    return (
      <>
        <PageHeader title={text("المحادثات", "Messages")} />
        <main className="rawaj-communication-v2 container-wide mobile-page-bottom pt-4">
          <CommunicationSignedOut returnTo="/chats" />
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader title={text("المحادثات", "Messages")} />
      <main className="rawaj-communication-v2 rawaj-communication-v2--messages container-wide mobile-page-bottom space-y-4 pt-4">
        <CommunicationCenterHero
          mode="messages"
          unreadMessages={conversations.reduce(
            (total, conversation) => total + conversation.unreadCount,
            0,
          )}
          conversationCount={conversations.length}
        />
        <CommunicationSafetyNote />

        <div className="rawaj-message-workspace">
          <aside
            className={`rawaj-conversation-sidebar ${
              !isDesktop && viewingConversationOnMobile ? "hidden" : ""
            }`}
          >
            <div className="rawaj-conversation-sidebar__heading">
              <h2>
                <MessageCircle aria-hidden="true" />
                {text("المحادثات", "Conversations")}
              </h2>
              <span>{filteredConversations.length}</span>
            </div>
            <CommunicationSearch
              value={conversationQuery}
              onChange={setConversationQuery}
              placeholder={text("ابحث باسم أو إعلان أو رسالة", "Search conversations")}
              label={text("بحث في المحادثات", "Search conversations")}
            />
            {loadingConversations ? (
              <PanelText>{text("جاري تحميل المحادثات.", "Loading conversations.")}</PanelText>
            ) : conversationError ? (
              <PanelText>{conversationError.message}</PanelText>
            ) : conversations.length === 0 ? (
              <PanelText>
                {text(
                  "لا توجد محادثات بعد. افتح إعلانا معتمدا وابدأ محادثة من صفحة الإعلان.",
                  "No conversations yet. Open an approved listing and start a conversation from it.",
                )}
              </PanelText>
            ) : filteredConversations.length === 0 ? (
              <PanelText>
                {text("لا توجد محادثات تطابق بحثك.", "No conversations match your search.")}
              </PanelText>
            ) : (
              <div className="rawaj-conversation-list">
                {filteredConversations.map((conversation) => (
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
                ))}
              </div>
            )}
          </aside>

          <section
            className={`rawaj-message-panel ${
              !isDesktop && !viewingConversationOnMobile && !missingConversationTarget
                ? "hidden"
                : ""
            }`}
          >
            {missingConversationTarget ? (
              <div className="grid flex-1 place-items-center p-6 text-center">
                <div className="max-w-md">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-warning/10 text-warning">
                    <MessageCircle className="h-6 w-6" />
                  </span>
                  <h2 className="mt-4 text-base font-extrabold">
                    {text("المحادثة غير متاحة", "Conversation unavailable")}
                  </h2>
                  <p className="mt-2 text-xs leading-6 text-muted-foreground">
                    {text(
                      "الرابط المطلوب لا يشير إلى محادثة متاحة في حسابك. لم نفتح أي محادثة أخرى بدلًا منها.",
                      "The requested link does not point to an available conversation in your account. No other conversation was opened instead.",
                    )}
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {conversations.length > 0 && (
                      <button
                        type="button"
                        onClick={openFirstAvailableConversation}
                        className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
                      >
                        {text("فتح محادثة متاحة", "Open an available conversation")}
                      </button>
                    )}
                    <Link
                      to="/listings"
                      className="rounded-xl bg-muted-surface px-4 py-2 text-xs font-bold text-foreground hairline"
                    >
                      {text("تصفح الإعلانات", "Browse listings")}
                    </Link>
                  </div>
                </div>
              </div>
            ) : !selectedConversation ? (
              <div className="grid flex-1 place-items-center p-6 text-center">
                <PanelText>{text("اختر محادثة لعرض الرسائل.", "Choose a conversation.")}</PanelText>
              </div>
            ) : (
              <>
                <header className="rawaj-message-header">
                  <div className="rawaj-message-header__row">
                    {!isDesktop && viewingConversationOnMobile && (
                      <button
                        type="button"
                        onClick={() => setViewingConversationOnMobile(false)}
                        className="inline-flex items-center gap-1 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold hairline"
                        aria-label={text("المحادثات", "Conversations")}
                      >
                        ← {text("المحادثات", "Conversations")}
                      </button>
                    )}
                    <Avatar
                      name={selectedConversation.otherParticipant.displayName}
                      url={selectedConversation.otherParticipant.avatarUrl}
                    />
                    <div className="rawaj-message-header__copy">
                      <h2 className="truncate text-sm font-extrabold">
                        {selectedConversation.otherParticipant.displayName}
                      </h2>
                      {selectedConversation.listingId ? (
                        <Link
                          to="/listings/$id"
                          params={{ id: selectedConversation.listingId }}
                          className="truncate text-xs font-semibold text-primary"
                        >
                          {selectedConversation.listingTitle}
                        </Link>
                      ) : (
                        <span className="block truncate text-xs font-semibold text-muted-foreground">
                          {selectedConversation.listingTitle} ·{" "}
                          {text("إعلان محذوف", "Deleted listing")}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleBlock()}
                      aria-label={text("حظر المستخدم", "Block user")}
                      className="inline-flex items-center gap-1 rounded-xl bg-destructive/10 px-3 py-2 text-[11px] font-bold text-destructive"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      {text("حظر", "Block")}
                    </button>
                  </div>
                  {selectedConversation.status === "archived" && (
                    <p className="mt-3 rounded-xl bg-warning/10 p-2 text-xs font-semibold text-warning">
                      {text(
                        "تم حذف الإعلان. احتفظنا بالمحادثة كسجل ولا يمكن إرسال رسائل جديدة.",
                        "The listing was deleted. This conversation is preserved as history and cannot receive new messages.",
                      )}
                    </p>
                  )}
                  {selectedConversation.status === "blocked" && (
                    <p className="mt-3 rounded-xl bg-destructive/10 p-2 text-xs font-semibold text-destructive">
                      {text(
                        "هذه المحادثة محظورة ولا تقبل رسائل جديدة.",
                        "This conversation is blocked and cannot receive new messages.",
                      )}
                    </p>
                  )}
                </header>

                <div className="rawaj-message-stream">
                  {loadingMessages ? (
                    <PanelText>{text("جاري تحميل الرسائل.", "Loading messages.")}</PanelText>
                  ) : messageError ? (
                    <PanelText>{messageError.message}</PanelText>
                  ) : messages.length === 0 ? (
                    <PanelText>
                      {text(
                        "لا توجد رسائل بعد. اكتب أول رسالة حقيقية لهذه المحادثة.",
                        "No messages yet. Write the first real message in this conversation.",
                      )}
                    </PanelText>
                  ) : (
                    messages.map((message) => {
                      const mine = message.senderUserId === auth.profile?.id;
                      return (
                        <article key={message.id} className="rawaj-message-bubble" data-mine={mine}>
                          <p className="whitespace-pre-line break-words">{message.body}</p>
                          <p className="rawaj-message-bubble__time">
                            {formatDateTime(message.createdAt, language)}
                          </p>
                          {!mine && (
                            <button
                              type="button"
                              disabled={reportingMessageId === message.id}
                              onClick={() => void handleReport(message)}
                              aria-label={text("إبلاغ عن هذه الرسالة", "Report this message")}
                              className="rawaj-message-bubble__report"
                            >
                              <Flag className="h-3 w-3" />
                              {reportingMessageId === message.id
                                ? text("جارٍ الإبلاغ", "Reporting")
                                : text("إبلاغ", "Report")}
                            </button>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>

                <form
                  onSubmit={(event) => void handleSend(event)}
                  className="rawaj-message-composer"
                >
                  <input
                    value={blockReason}
                    onChange={(event) => setBlockReason(event.target.value)}
                    maxLength={300}
                    placeholder={text("سبب الحظر اختياري", "Optional block reason")}
                    className="rawaj-message-composer__block-reason mb-2"
                  />
                  {selectedConversation.status === "active" ? (
                    <div className="mb-2">
                      <p className="mb-1.5 text-[10px] font-bold text-muted-foreground">
                        {text("ردود سريعة", "Quick replies")}
                      </p>
                      <div className="rawaj-quick-replies">
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
                    </div>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <textarea
                      value={body}
                      onChange={(event) => setBody(event.target.value)}
                      maxLength={2000}
                      rows={2}
                      placeholder={text("اكتب رسالة...", "Write a message...")}
                      aria-label={text("اكتب رسالة...", "Write a message...")}
                    />
                    <button
                      type="submit"
                      disabled={
                        sending ||
                        body.trim().length === 0 ||
                        selectedConversation.status !== "active"
                      }
                      className="rawaj-message-composer__send"
                    >
                      <Send className="h-4 w-4" />
                      {sending ? text("جاري الإرسال", "Sending") : text("إرسال", "Send")}
                    </button>
                  </div>
                  {notice && (
                    <p className="mt-2 text-xs font-semibold text-emerald-trust">{notice}</p>
                  )}
                </form>
              </>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-card text-sm font-bold text-primary hairline">
      {url ? (
        <img
          src={url}
          alt={name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        name.slice(0, 1)
      )}
    </span>
  );
}

function PanelText({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl bg-muted-surface p-3 text-xs leading-6 text-muted-foreground">
      {children}
    </p>
  );
}

function formatDateTime(value: string, language: "ar" | "en") {
  if (!value) return "";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
