import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, pattern, replacement, label) {
  const source = await readFile(path, "utf8");
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Missing refinement target: ${label}`);
  await writeFile(path, next, "utf8");
}

const chats = "src/routes/chats.tsx";

await replaceOnce(
  chats,
  '  const [blockReason, setBlockReason] = useState("");\n',
  "",
  "remove block reason state",
);

await replaceOnce(
  chats,
  "      reason: blockReason || null,",
  "      reason: null,",
  "remove block reason payload",
);

await replaceOnce(
  chats,
  `  if (auth.status !== "signedIn") {
    return (`,
  `  if (auth.status === "loading") {
    return (
      <>
        <PageHeader title={text("المحادثات", "Messages")} />
        <main className="rawaj-communication-v2 container-wide mobile-page-bottom pt-4">
          <div className="rawaj-chat-state rawaj-chat-state--loading">
            <RefreshCw className="animate-spin" aria-hidden="true" />
            <strong>{text("جارٍ تجهيز محادثاتك", "Preparing your messages")}</strong>
            <p>
              {text(
                "نستعيد جلسة حسابك وقائمة المحادثات بأمان.",
                "Restoring your account session and conversations securely.",
              )}
            </p>
          </div>
        </main>
      </>
    );
  }

  if (auth.status !== "signedIn") {
    return (`,
  "auth loading state",
);

await replaceOnce(
  chats,
  `        <CommunicationCenterHero
          mode="messages"
          unreadMessages={conversations.reduce(
            (total, conversation) => total + conversation.unreadCount,
            0,
          )}
          conversationCount={conversations.length}
        />
        <CommunicationSafetyNote />`,
  `        {(isDesktop || !viewingConversationOnMobile) && (
          <>
            <CommunicationCenterHero
              mode="messages"
              unreadMessages={conversations.reduce(
                (total, conversation) => total + conversation.unreadCount,
                0,
              )}
              conversationCount={conversations.length}
            />
            <CommunicationSafetyNote />
          </>
        )}`,
  "hide overview while viewing mobile conversation",
);

await replaceOnce(
  chats,
  `                    onSelect={() => {
                      if (!isDesktop) setViewingConversationOnMobile(true);
                      void navigate({`,
  `                    onSelect={() => {
                      if (!isDesktop) {
                        setViewingConversationOnMobile(true);
                        window.requestAnimationFrame(() => window.scrollTo({ top: 0 }));
                      }
                      void navigate({`,
  "scroll to mobile conversation",
);

await replaceOnce(
  chats,
  `                        onClick={() => setViewingConversationOnMobile(false)}`,
  `                        onClick={() => {
                          setViewingConversationOnMobile(false);
                          window.requestAnimationFrame(() => window.scrollTo({ top: 0 }));
                        }}`,
  "scroll to conversation list",
);

await replaceOnce(
  chats,
  `                  <input
                    value={blockReason}
                    onChange={(event) => setBlockReason(event.target.value)}
                    maxLength={300}
                    placeholder={text("سبب الحظر اختياري", "Optional block reason")}
                    className="rawaj-message-composer__block-reason mb-2"
                  />
`,
  "",
  "remove block reason input from composer",
);

const css = "src/mobile-app-stabilization.css";
await replaceOnce(
  css,
  `@media (max-width: 1023px) {
  .rawaj-message-workspace {`,
  `@media (max-width: 1023px) {
  .rawaj-route-chats .container-wide {
    padding-inline: 0.75rem;
  }

  .rawaj-communication-v2--messages .rawaj-communication-hero {
    border-radius: 1.2rem;
    padding: 0.85rem;
  }

  .rawaj-communication-v2--messages .rawaj-communication-hero__copy h1 {
    margin-top: 0.45rem;
    font-size: 1.1rem;
  }

  .rawaj-communication-v2--messages .rawaj-communication-hero__copy > span {
    display: -webkit-box;
    overflow: hidden;
    margin-top: 0.35rem;
    font-size: 0.6rem;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .rawaj-communication-v2--messages .rawaj-communication-hero__metrics,
  .rawaj-communication-v2--messages .rawaj-communication-hero__actions {
    margin-top: 0.65rem;
  }

  .rawaj-communication-v2--messages .rawaj-communication-safety {
    padding: 0.7rem;
  }

  .rawaj-message-workspace {`,
  "compact mobile chat overview",
);

console.log("Refined RAWAJ mobile chat experience.");
