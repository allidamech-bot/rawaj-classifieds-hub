import { readFile, rm, writeFile } from "node:fs/promises";

const path = "src/routes/chats.tsx";
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}
function replaceRegexOnce(pattern, replacement, label) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const count = [...source.matchAll(new RegExp(pattern.source, flags))].length;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(pattern, replacement);
}

replaceOnce(
  '  const [blockReason, setBlockReason] = useState("");\n  const [viewingConversationOnMobile',
  '  const [blockReason, setBlockReason] = useState("");\n  const [blocking, setBlocking] = useState(false);\n  const [viewingConversationOnMobile',
  "chat blocking state",
);
replaceOnce(
  '    setBlockReason("");\n    setNotice("");',
  '    setBlockReason("");\n    setBlocking(false);\n    setNotice("");',
  "chat account reset blocking",
);
replaceRegexOnce(
  /  async function loadConversations\(\) \{[\s\S]*?\n  \}\n\n  async function loadMessages/,
  `  async function loadConversations() {
    const profileId = auth.profile?.id ?? null;
    if (!profileId) return;
    const requestId = ++conversationsRequestIdRef.current;
    setLoadingConversations(true);
    setConversationError(null);
    try {
      const result = await fetchMyConversations();
      if (requestId !== conversationsRequestIdRef.current || profileId !== profileIdRef.current) {
        return;
      }
      if (result.ok) {
        setConversations(result.data);
      } else {
        setConversationError(result.error);
      }
    } catch (caught) {
      if (requestId !== conversationsRequestIdRef.current || profileId !== profileIdRef.current) {
        return;
      }
      setConversationError({
        code: "unknown",
        message:
          caught instanceof Error
            ? caught.message
            : text("تعذر تحميل المحادثات.", "Could not load conversations."),
        operation: "chat_conversations_load",
      });
    } finally {
      if (requestId === conversationsRequestIdRef.current && profileId === profileIdRef.current) {
        setLoadingConversations(false);
      }
    }
  }

  async function loadMessages`,
  "chat conversations load lifecycle",
);
replaceRegexOnce(
  /  async function loadMessages\(conversationId: string\) \{[\s\S]*?\n  \}\n\n  useEffect\(\(\) => \{\n    if \(auth\.status !== "signedIn"\)/,
  `  async function loadMessages(conversationId: string) {
    const profileId = auth.profile?.id ?? null;
    if (!profileId) return;
    const requestId = ++messagesRequestIdRef.current;
    setLoadingMessages(true);
    setMessageError(null);
    try {
      const result = await fetchConversationMessages(conversationId);
      if (
        requestId !== messagesRequestIdRef.current ||
        profileId !== profileIdRef.current ||
        conversationId !== selectedConversationIdRef.current
      ) {
        return;
      }
      if (!result.ok) {
        setMessageError(result.error);
        return;
      }
      setMessages(sortAndDedupeMessages(result.data, conversationId));
      const markResult = await markConversationRead(conversationId);
      if (
        requestId !== messagesRequestIdRef.current ||
        profileId !== profileIdRef.current ||
        conversationId !== selectedConversationIdRef.current
      ) {
        return;
      }
      if (!markResult.ok) setNotice(markResult.error.message);
    } catch (caught) {
      if (
        requestId !== messagesRequestIdRef.current ||
        profileId !== profileIdRef.current ||
        conversationId !== selectedConversationIdRef.current
      ) {
        return;
      }
      setMessageError({
        code: "unknown",
        message:
          caught instanceof Error
            ? caught.message
            : text("تعذر تحميل الرسائل.", "Could not load messages."),
        operation: "chat_messages_load",
      });
    } finally {
      if (
        requestId === messagesRequestIdRef.current &&
        profileId === profileIdRef.current &&
        conversationId === selectedConversationIdRef.current
      ) {
        setLoadingMessages(false);
      }
    }
  }

  useEffect(() => {
    if (auth.status !== "signedIn")`,
  "chat messages load lifecycle",
);
replaceOnce(
  `      if (profileIdRef.current === profileId) await loadConversations();\n    } finally {`,
  `      if (profileIdRef.current === profileId) await loadConversations();\n    } catch (caught) {\n      if (uploadedPath) {\n        try {\n          if (voice) await removeChatAudio(uploadedPath);\n          else await removeChatImage(uploadedPath);\n        } catch {\n          // Best-effort cleanup; the user-facing send failure remains primary.\n        }\n      }\n      if (\n        accountGenerationRef.current === accountGeneration &&\n        profileIdRef.current === profileId &&\n        selectedConversationIdRef.current === conversationId\n      ) {\n        setMessageError({\n          code: "unknown",\n          message:\n            caught instanceof Error\n              ? caught.message\n              : text("تعذر إرسال الرسالة.", "Could not send the message."),\n          operation: "chat_message_send",\n        });\n      }\n    } finally {`,
  "chat send exception cleanup",
);
replaceOnce(
  `      setNotice(\n        result.ok\n          ? text("تم إرسال بلاغ الرسالة للمراجعة.", "Message report sent for review.")\n          : result.error.message,\n      );\n    } finally {`,
  `      setNotice(\n        result.ok\n          ? text("تم إرسال بلاغ الرسالة للمراجعة.", "Message report sent for review.")\n          : result.error.message,\n      );\n    } catch (caught) {\n      if (\n        profileIdRef.current === profileId &&\n        accountGenerationRef.current === accountGeneration &&\n        selectedConversationIdRef.current === conversationId\n      ) {\n        setNotice(\n          caught instanceof Error\n            ? caught.message\n            : text("تعذر إرسال بلاغ الرسالة.", "Could not report the message."),\n        );\n      }\n    } finally {`,
  "chat report exception handling",
);
replaceOnce(
  `    blockInFlightRef.current.add(blockScope);\n    setNotice("");`,
  `    blockInFlightRef.current.add(blockScope);\n    setBlocking(true);\n    setNotice("");`,
  "chat block busy start",
);
replaceOnce(
  `      if (result.ok && profileIdRef.current === profileId) await loadConversations();\n    } finally {`,
  `      if (result.ok && profileIdRef.current === profileId) await loadConversations();\n    } catch (caught) {\n      if (\n        accountGenerationRef.current === accountGeneration &&\n        profileIdRef.current === profileId &&\n        selectedConversationIdRef.current === conversationId\n      ) {\n        setNotice(\n          caught instanceof Error\n            ? caught.message\n            : text("تعذر حظر المحادثة.", "Could not block the conversation."),\n        );\n      }\n    } finally {`,
  "chat block exception handling",
);
replaceOnce(
  `      if (accountGenerationRef.current === accountGeneration) {\n        blockInFlightRef.current.delete(blockScope);\n      }`,
  `      if (accountGenerationRef.current === accountGeneration) {\n        blockInFlightRef.current.delete(blockScope);\n        setBlocking(false);\n      }`,
  "chat block busy release",
);
replaceOnce(
  `                       onClick={() => void handleBlock()}\n                       aria-label={text("حظر المستخدم", "Block user")}\n                       className=`,
  `                       onClick={() => void handleBlock()}\n                       disabled={blocking}\n                       aria-busy={blocking}\n                       aria-label={text("حظر المستخدم", "Block user")}\n                       className=`,
  "chat block button disabled",
);
replaceOnce(
  `                       {text("حظر", "Block")}\n                     </button>`,
  `                       {blocking ? text("جارٍ الحظر", "Blocking") : text("حظر", "Block")}\n                     </button>`,
  "chat block button label",
);
replaceOnce(
  `                     value={blockReason}\n                     onChange={(event) => setBlockReason(event.target.value)}\n                     maxLength={300}`,
  `                     value={blockReason}\n                     onChange={(event) => setBlockReason(event.target.value)}\n                     disabled={blocking}\n                     maxLength={300}`,
  "chat block reason disabled",
);
replaceOnce(
  `                 <form\n                   onSubmit={(event) => void handleSend(event)}\n                   className=`,
  `                 <form\n                   onSubmit={(event) => void handleSend(event)}\n                   aria-busy={sending}\n                   className=`,
  "chat composer busy state",
);

await writeFile(path, source);
await rm("scripts/apply-chat-actions-integrity.mjs", { force: true });
