import { replaceOnce } from "./mobile-stabilization-patch-utils.mjs";

const chats = "src/routes/chats.tsx";

await replaceOnce(
  chats,
  'import { Ban, Flag, MessageCircle, Send } from "lucide-react";',
  'import { Ban, Flag, MessageCircle, RefreshCw, Send } from "lucide-react";',
  "chat icons",
);
await replaceOnce(
  chats,
  'import { useAuth } from "@/lib/use-auth";',
  'import { useAuth } from "@/lib/use-auth";\nimport { useConversationMessagesRealtime, useOnlinePresence } from "@/lib/use-online-presence";',
  "chat presence imports",
);
await replaceOnce(
  chats,
  `  const [isDesktop, setIsDesktop] = useState(false);
  const messagesRequestIdRef = useRef(0);`,
  `  const [isDesktop, setIsDesktop] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesRequestIdRef = useRef(0);`,
  "chat message end ref",
);
await replaceOnce(
  chats,
  `  const selectedConversation =
    targetResolution.kind === "selected" || targetResolution.kind === "default"
      ? targetResolution.conversation
      : null;`,
  `  const selectedConversation =
    targetResolution.kind === "selected" ||
    (isDesktop && targetResolution.kind === "default")
      ? targetResolution.conversation
      : null;`,
  "mobile does not auto-open first conversation",
);
await replaceOnce(
  chats,
  `  }, [conversationQuery, conversations, language]);

  useEffect(() => {`,
  `  }, [conversationQuery, conversations, language]);
  const { onlineUserIds } = useOnlinePresence(
    auth.profile?.id,
    auth.status === "signedIn",
  );

  useConversationMessagesRealtime({
    conversationId: selectedConversation?.id ?? null,
    enabled: auth.status === "signedIn" && Boolean(selectedConversation),
    onMessage: (message) => {
      setMessages((current) =>
        current.some((item) => item.id === message.id) ? current : [...current, message],
      );
      if (
        auth.profile?.id &&
        selectedConversation?.id &&
        message.senderUserId !== auth.profile.id
      ) {
        void markConversationRead(auth.profile.id, selectedConversation.id);
      }
      void loadConversations();
    },
  });

  useEffect(() => {`,
  "chat realtime and presence",
);
await replaceOnce(
  chats,
  `  useEffect(() => {
    autoOpenedConversationRef.current = null;
  }, [search.conversation]);`,
  `  useEffect(() => {
    autoOpenedConversationRef.current = null;
  }, [search.conversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      block: "end",
      behavior: loadingMessages ? "auto" : "smooth",
    });
  }, [loadingMessages, messages.length, selectedConversation?.id]);`,
  "chat auto-scroll",
);
await replaceOnce(
  chats,
  `      setConversations(result.data);
      if (!search.conversation && result.data[0]) {
        void navigate({
          to: "/chats",
          search: { conversation: result.data[0].id },
          replace: true,
        });
      }`,
  `      setConversations(result.data);`,
  "remove first conversation navigation",
);
await replaceOnce(
  chats,
  `            {loadingConversations ? (
              <PanelText>{text("جاري تحميل المحادثات.", "Loading conversations.")}</PanelText>
            ) : conversationError ? (
              <PanelText>{conversationError.message}</PanelText>
            ) : conversations.length === 0 ? (
              <PanelText>
                {text(
                  "لا توجد محادثات بعد. افتح إعلانا معتمدا وابدأ محادثة من صفحة الإعلان.",
                  "No conversations yet. Open an approved listing and start a conversation from it.",
                )}
              </PanelText>`,
  `            {loadingConversations ? (
              <div className="rawaj-chat-state rawaj-chat-state--loading">
                <RefreshCw className="animate-spin" aria-hidden="true" />
                <strong>{text("جاري تحميل محادثاتك", "Loading your conversations")}</strong>
                <p>
                  {text(
                    "نرتب الرسائل والأطراف المرتبطة بإعلاناتك.",
                    "Preparing your listing conversations.",
                  )}
                </p>
              </div>
            ) : conversationError ? (
              <div className="rawaj-chat-state" data-tone="error">
                <RefreshCw aria-hidden="true" />
                <strong>{text("تعذر تحميل المحادثات", "Could not load conversations")}</strong>
                <p>{conversationError.message}</p>
                <button type="button" onClick={() => void loadConversations()}>
                  {text("إعادة المحاولة", "Try again")}
                </button>
              </div>
            ) : conversations.length === 0 ? (
              <div className="rawaj-chat-state">
                <MessageCircle aria-hidden="true" />
                <strong>{text("ابدأ أول محادثة", "Start your first conversation")}</strong>
                <p>
                  {text(
                    "افتح إعلاناً واضغط مراسلة البائع. ستظهر المحادثات هنا مرتبة مع حالة الاتصال وآخر رسالة.",
                    "Open a listing and message the seller. Conversations will appear here with presence and the latest message.",
                  )}
                </p>
                <Link to="/listings">{text("تصفح الإعلانات", "Browse listings")}</Link>
              </div>`,
  "chat loading error and empty states",
);
await replaceOnce(
  chats,
  `                    selected={selectedConversation?.id === conversation.id}
                    onSelect={() => {`,
  `                    selected={selectedConversation?.id === conversation.id}
                    online={onlineUserIds.has(conversation.otherParticipant.userId)}
                    onSelect={() => {`,
  "conversation online prop",
);
await replaceOnce(
  chats,
  `                    <Avatar
                      name={selectedConversation.otherParticipant.displayName}
                      url={selectedConversation.otherParticipant.avatarUrl}
                    />`,
  `                    <Avatar
                      name={selectedConversation.otherParticipant.displayName}
                      url={selectedConversation.otherParticipant.avatarUrl}
                      online={onlineUserIds.has(selectedConversation.otherParticipant.userId)}
                    />`,
  "chat header avatar presence",
);
await replaceOnce(
  chats,
  `                      <h2 className="truncate text-sm font-extrabold">
                        {selectedConversation.otherParticipant.displayName}
                      </h2>
                      {selectedConversation.listingId ? (`,
  `                      <h2 className="truncate text-sm font-extrabold">
                        {selectedConversation.otherParticipant.displayName}
                      </h2>
                      <p
                        className="rawaj-message-header__presence"
                        data-online={onlineUserIds.has(
                          selectedConversation.otherParticipant.userId,
                        )}
                      >
                        <span aria-hidden="true" />
                        {onlineUserIds.has(selectedConversation.otherParticipant.userId)
                          ? text("متصل الآن", "Online now")
                          : text("غير متصل", "Offline")}
                      </p>
                      {selectedConversation.listingId ? (`,
  "chat header presence label",
);
await replaceOnce(
  chats,
  `                  )}
                </div>

                <form`,
  `                  )}
                  <div ref={messagesEndRef} aria-hidden="true" />
                </div>

                <form`,
  "chat message end anchor",
);
await replaceOnce(
  chats,
  `function Avatar({ name, url }: { name: string; url: string | null }) {
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
}`,
  `function Avatar({
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
      {url ? (
        <img src={url} alt={name} loading="lazy" decoding="async" />
      ) : (
        name.slice(0, 1)
      )}
      <i aria-hidden="true" />
    </span>
  );
}`,
  "chat avatar component",
);

const communication = "src/features/communication/CommunicationExperience.tsx";
await replaceOnce(
  communication,
  `export function ConversationSummaryItem({
  conversation,
  selected,
  onSelect,
}: {
  conversation: Conversation;
  selected: boolean;
  onSelect: () => void;
}) {
  return (`,
  `export function ConversationSummaryItem({
  conversation,
  selected,
  online,
  onSelect,
}: {
  conversation: Conversation;
  selected: boolean;
  online: boolean;
  onSelect: () => void;
}) {
  const { text } = useUiPreferences();
  return (`,
  "conversation summary presence contract",
);
await replaceOnce(
  communication,
  `      aria-current={selected ? "true" : undefined}
    >`,
  `      aria-current={selected ? "true" : undefined}
      aria-label={text(
        "فتح المحادثة مع " + conversation.otherParticipant.displayName,
        "Open conversation with " + conversation.otherParticipant.displayName,
      )}
    >`,
  "conversation summary accessible label",
);
await replaceOnce(
  communication,
  `        <strong>{conversation.otherParticipant.displayName}</strong>
        <small>{conversation.listingTitle}</small>`,
  `        <strong>{conversation.otherParticipant.displayName}</strong>
        <span className="rawaj-conversation-summary__presence" data-online={online}>
          <i aria-hidden="true" />
          {online ? text("متصل الآن", "Online now") : text("غير متصل", "Offline")}
        </span>
        <small>{conversation.listingTitle}</small>`,
  "conversation summary presence label",
);
