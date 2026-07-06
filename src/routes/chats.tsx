import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Ban, Flag, MessageCircle, Send, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import {
  fetchConversationMessages,
  fetchMyConversations,
  markConversationRead,
  sendConversationMessage,
  createMessageReport,
  blockConversationParticipant,
} from "@/lib/classifieds-api";
import type { ClassifiedsError, Conversation, ConversationMessage } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

const chatsSearchSchema = z.object({
  conversation: z.string().optional(),
});

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

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === search.conversation) ?? conversations[0] ?? null,
    [conversations, search.conversation],
  );

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversation?.id ?? null;
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (!selectedConversation) {
      setViewingConversationOnMobile(false);
    }
  }, [selectedConversation]);

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
      const exists = conversations.some((c) => c.id === search.conversation);
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
    if (requestId !== messagesRequestIdRef.current) {
      return;
    }
    if (result.ok) {
      setMessages(result.data);
      const markResult = await markConversationRead(profileId, conversationId);
      if (requestId !== messagesRequestIdRef.current) {
        return;
      }
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
    const profileId = auth.profile.id;
    const conversationId = selectedConversation.id;
    const cleanBody = body.trim();
    if (!cleanBody) return;
    setNotice("");
    setMessageError(null);
    setSending(true);
    const result = await sendConversationMessage(profileId, conversationId, cleanBody);
    setSending(false);
    if (selectedConversationIdRef.current !== conversationId || auth.profile?.id !== profileId)
      return;
    if (!result.ok) {
      setMessageError(result.error);
      return;
    }
    setBody("");
    setMessages((current) => [...current, result.data]);
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

  if (auth.status !== "signedIn") {
    return (
      <>
        <PageHeader title={text("المحادثات", "Messages")} />
        <main className="container-wide mobile-page-bottom pt-4">
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
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader title={text("المحادثات", "Messages")} />
      <main className="container-wide mobile-page-bottom space-y-4 pt-4">
        <section className="rounded-2xl bg-card p-4 hairline shadow-soft">
          <h1 className="text-lg font-extrabold">{text("رسائلك", "Your messages")}</h1>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">
            {text(
              "تابع المحادثات المرتبطة بإعلانات حقيقية. لا نعرض حالات اتصال أو قراءة غير مدعومة.",
              "Follow conversations linked to real listings. Unsupported online or read states are not shown.",
            )}
          </p>
        </section>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/"
            className="rounded-xl bg-card px-3 py-2 text-xs font-bold text-foreground hairline"
          >
            {text("الرئيسية", "Home")}
          </Link>
          <Link
            to="/listings"
            className="rounded-xl bg-card px-3 py-2 text-xs font-bold text-foreground hairline"
          >
            {text("تصفح الإعلانات", "Browse listings")}
          </Link>
        </div>
        <section className="flex items-start gap-3 rounded-2xl bg-warning/10 p-4 hairline">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p className="text-xs leading-6">
            {text(
              "المحادثات مرتبطة بإعلانات معتمدة فقط. اتفق على المعاينة في مكان عام وآمن ولا تحول أي مبلغ قبل التأكد.",
              "Conversations are linked only to approved listings. Meet safely and do not transfer money before verifying.",
            )}
          </p>
        </section>

        <div className="grid min-h-[60dvh] grid-cols-1 gap-3 lg:min-h-[560px] lg:grid-cols-[320px_1fr]">
          <aside
            className={`rounded-2xl bg-card p-3 hairline ${
              !isDesktop && viewingConversationOnMobile ? "hidden" : ""
            }`}
          >
            <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold">
              <MessageCircle className="h-4 w-4 text-primary" />
              {text("قائمة المحادثات", "Conversation list")}
            </h2>
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
            ) : (
              <div className="space-y-2">
                {conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => {
                      if (!isDesktop) setViewingConversationOnMobile(true);
                      void navigate({
                        to: "/chats",
                        search: { conversation: conversation.id },
                      });
                    }}
                    className={`w-full rounded-xl p-3 text-start transition hairline ${
                      selectedConversation?.id === conversation.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted-surface hover:bg-secondary"
                    }`}
                    aria-current={selectedConversation?.id === conversation.id ? "true" : undefined}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={conversation.otherParticipant.displayName}
                        url={conversation.otherParticipant.avatarUrl}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">
                          {conversation.otherParticipant.displayName}
                        </p>
                        <p className="truncate text-[11px] opacity-80">
                          {conversation.listingTitle}
                        </p>
                      </div>
                      {conversation.unreadCount > 0 && (
                        <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-gold-foreground">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                    {conversation.lastMessagePreview && (
                      <p className="mt-2 truncate text-xs opacity-80">
                        {conversation.lastMessagePreview}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section
            className={`flex min-h-[60dvh] flex-col rounded-2xl bg-card hairline lg:min-h-[560px] ${
              !isDesktop && !viewingConversationOnMobile ? "hidden" : ""
            }`}
          >
            {!selectedConversation ? (
              <div className="grid flex-1 place-items-center p-6 text-center">
                <PanelText>{text("اختر محادثة لعرض الرسائل.", "Choose a conversation.")}</PanelText>
              </div>
            ) : (
              <>
                <header className="border-b border-border p-4">
                  <div className="flex items-center gap-3">
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
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-extrabold">
                        {selectedConversation.otherParticipant.displayName}
                      </h2>
                      <Link
                        to="/listings/$id"
                        params={{ id: selectedConversation.listingId }}
                        className="truncate text-xs font-semibold text-primary"
                      >
                        {selectedConversation.listingTitle}
                      </Link>
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
                  {selectedConversation.status === "blocked" && (
                    <p className="mt-3 rounded-xl bg-destructive/10 p-2 text-xs font-semibold text-destructive">
                      {text(
                        "هذه المحادثة محظورة ولا تقبل رسائل جديدة.",
                        "This conversation is blocked and cannot receive new messages.",
                      )}
                    </p>
                  )}
                </header>

                <div className="flex-1 space-y-2 overflow-y-auto p-4">
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
                        <article
                          key={message.id}
                          className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-6 ${
                            mine
                              ? "ms-auto bg-primary text-primary-foreground"
                              : "me-auto bg-muted-surface text-foreground"
                          }`}
                        >
                          <p className="whitespace-pre-line break-words">{message.body}</p>
                          <p className="mt-1 text-[10px] opacity-70">
                            {formatDateTime(message.createdAt, language)}
                          </p>
                          {!mine && (
                            <button
                              type="button"
                              disabled={reportingMessageId === message.id}
                              onClick={() => void handleReport(message)}
                              aria-label={text("إبلاغ عن هذه الرسالة", "Report this message")}
                              className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold opacity-80"
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
                  className="border-t border-border p-3"
                >
                  <input
                    value={blockReason}
                    onChange={(event) => setBlockReason(event.target.value)}
                    maxLength={300}
                    placeholder={text("سبب الحظر اختياري", "Optional block reason")}
                    className="mb-2 w-full rounded-xl bg-muted-surface px-3 py-2 text-xs outline-none hairline"
                  />
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <textarea
                      value={body}
                      onChange={(event) => setBody(event.target.value)}
                      maxLength={2000}
                      rows={2}
                      placeholder={text("اكتب رسالة...", "Write a message...")}
                      aria-label={text("اكتب رسالة...", "Write a message...")}
                      className="min-h-12 rounded-xl bg-muted-surface px-3 py-2 text-sm outline-none hairline"
                    />
                    <button
                      type="submit"
                      disabled={
                        sending ||
                        body.trim().length === 0 ||
                        selectedConversation.status === "blocked"
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
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

function StatePanel({
  title,
  body,
  actionTo,
  actionSearch,
  actionLabel,
}: {
  title: string;
  body: string;
  actionTo?: "/login" | "/listings";
  actionSearch?: Record<string, string>;
  actionLabel?: string;
}) {
  return (
    <section className="rounded-2xl bg-card p-8 text-center hairline">
      <MessageCircle className="mx-auto h-7 w-7 text-primary" />
      <h2 className="mt-3 text-base font-extrabold">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-muted-foreground">{body}</p>
      {actionTo && actionLabel && (
        <Link
          to={actionTo}
          search={actionSearch}
          className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
        >
          {actionLabel}
        </Link>
      )}
    </section>
  );
}

function formatDateTime(value: string, language: "ar" | "en") {
  if (!value) return "";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
