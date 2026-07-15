import { readFileSync, writeFileSync } from "node:fs";

const routePath = "src/routes/chats.tsx";
const source = readFileSync(routePath, "utf8");
const before = `  useEffect(() => {
    profileIdRef.current = auth.profile?.id ?? null;
    setComposerDrafts({});
    setSendingScopes(new Set());
    sendInFlightScopesRef.current.clear();
    setConfirmedRisk(null);
    setBlockReason("");
    setNotice("");
  }, [auth.profile?.id]);`;
const after = `  useEffect(() => {
    const nextProfileId = auth.profile?.id ?? null;
    const previousProfileId = profileIdRef.current;
    profileIdRef.current = nextProfileId;
    if (previousProfileId === nextProfileId) return;

    setComposerDrafts({});
    setConfirmedRisk(null);
    setBlockReason("");
    setNotice("");

    if (previousProfileId !== null) {
      conversationsRequestIdRef.current += 1;
      messagesRequestIdRef.current += 1;
      setConversations([]);
      setMessages([]);
      setConversationError(null);
      setMessageError(null);
      setLoadingConversations(false);
      setLoadingMessages(false);
      setViewingConversationOnMobile(false);
      if (search.conversation) {
        void navigate({ to: "/chats", search: {}, replace: true });
      }
    }
  }, [auth.profile?.id, navigate, search.conversation]);`;

if (source.includes(after)) {
  console.log("Account transition isolation already applied.");
  process.exit(0);
}

const count = source.split(before).length - 1;
if (count !== 1) {
  throw new Error(`Expected one profile transition effect, found ${count}.`);
}

writeFileSync(routePath, source.replace(before, after));
console.log("Account transition isolation applied.");
