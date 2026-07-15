import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  const first = source.indexOf(from);
  const last = source.lastIndexOf(from);
  if (first === -1 || first !== last) {
    throw new Error(`${label}: expected exactly one source match`);
  }
  return source.slice(0, first) + to + source.slice(first + from.length);
}

function replacePattern(source, pattern, to, label) {
  if (source.includes(to)) return source;
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const matches = [...source.matchAll(new RegExp(pattern.source, flags))];
  if (matches.length !== 1) {
    throw new Error(`${label}: expected exactly one regex match, found ${matches.length}`);
  }
  return source.replace(pattern, to);
}

const routePath = "src/routes/chats.tsx";
let route = readFileSync(routePath, "utf8");

route = replaceOnce(
  route,
  `  const [body, setBody] = useState("");\n  const [conversationQuery, setConversationQuery] = useState("");\n  const [sending, setSending] = useState(false);\n  const [notice, setNotice] = useState("");\n  const [confirmedRiskBody, setConfirmedRiskBody] = useState<string | null>(null);`,
  `  const [composerDrafts, setComposerDrafts] = useState<Record<string, string>>({});\n  const [conversationQuery, setConversationQuery] = useState("");\n  const [sendingScopes, setSendingScopes] = useState<Set<string>>(() => new Set());\n  const [notice, setNotice] = useState("");\n  const [confirmedRisk, setConfirmedRisk] = useState<{\n    scopeKey: string;\n    body: string;\n  } | null>(null);`,
  "scoped composer state",
);

route = replaceOnce(
  route,
  `  const selectedConversationIdRef = useRef<string | null>(null);\n  const autoOpenedConversationRef = useRef<string | null>(null);\n  const sendInFlightRef = useRef(false);`,
  `  const selectedConversationIdRef = useRef<string | null>(null);\n  const profileIdRef = useRef<string | null>(auth.profile?.id ?? null);\n  const autoOpenedConversationRef = useRef<string | null>(null);\n  const sendInFlightScopesRef = useRef<Set<string>>(new Set());`,
  "scope refs",
);

route = replaceOnce(
  route,
  `  const missingConversationTarget = targetResolution.kind === "missing";\n  const messageSafety = useMemo(() => analyzeMessageSafety(body), [body]);`,
  `  const missingConversationTarget = targetResolution.kind === "missing";\n  const composerScopeKey =\n    auth.profile?.id && selectedConversation?.id\n      ? \`${auth.profile.id}:${selectedConversation.id}\`\n      : null;\n  const body = composerScopeKey ? (composerDrafts[composerScopeKey] ?? "") : "";\n  const sending = composerScopeKey ? sendingScopes.has(composerScopeKey) : false;\n  const messageSafety = useMemo(() => analyzeMessageSafety(body), [body]);`,
  "derived composer scope",
);

route = replaceOnce(
  route,
  `  useEffect(() => {\n    selectedConversationIdRef.current = selectedConversation?.id ?? null;\n  }, [selectedConversation?.id]);`,
  `  useEffect(() => {\n    profileIdRef.current = auth.profile?.id ?? null;\n    setComposerDrafts({});\n    setSendingScopes(new Set());\n    sendInFlightScopesRef.current.clear();\n    setConfirmedRisk(null);\n    setBlockReason("");\n    setNotice("");\n  }, [auth.profile?.id]);\n\n  useEffect(() => {\n    selectedConversationIdRef.current = selectedConversation?.id ?? null;\n    setConfirmedRisk(null);\n    setBlockReason("");\n    setNotice("");\n    setMessageError(null);\n    setReportingMessageId(null);\n  }, [selectedConversation?.id]);`,
  "profile and conversation scope effects",
);

route = replaceOnce(
  route,
  `    if (requestId !== conversationsRequestIdRef.current || profileId !== auth.profile?.id) return;`,
  `    if (requestId !== conversationsRequestIdRef.current || profileId !== profileIdRef.current)\n      return;`,
  "conversation request account guard",
);

route = replaceOnce(
  route,
  `    if (requestId !== messagesRequestIdRef.current) return;\n    if (result.ok) {\n      setMessages(result.data);\n      const markResult = await markConversationRead(profileId, conversationId);\n      if (requestId !== messagesRequestIdRef.current) return;`,
  `    if (\n      requestId !== messagesRequestIdRef.current ||\n      profileId !== profileIdRef.current ||\n      conversationId !== selectedConversationIdRef.current\n    )\n      return;\n    if (result.ok) {\n      setMessages(result.data);\n      const markResult = await markConversationRead(profileId, conversationId);\n      if (\n        requestId !== messagesRequestIdRef.current ||\n        profileId !== profileIdRef.current ||\n        conversationId !== selectedConversationIdRef.current\n      )\n        return;`,
  "message request scope guards",
);

route = replacePattern(
  route,
  /  async function handleSend\(event: FormEvent<HTMLFormElement>\) \{[\s\S]*?\n  \}\n\n  async function handleReport/,
  `  function updateComposerDraft(scopeKey: string, value: string) {\n    setComposerDrafts((current) => {\n      if (value.length === 0) {\n        if (!(scopeKey in current)) return current;\n        const next = { ...current };\n        delete next[scopeKey];\n        return next;\n      }\n      if (current[scopeKey] === value) return current;\n      return { ...current, [scopeKey]: value };\n    });\n  }\n\n  function clearComposerDraftIfUnchanged(scopeKey: string, submittedBody: string) {\n    setComposerDrafts((current) => {\n      if ((current[scopeKey] ?? "").trim() !== submittedBody) return current;\n      const next = { ...current };\n      delete next[scopeKey];\n      return next;\n    });\n  }\n\n  function setCurrentComposerBody(value: string) {\n    if (!composerScopeKey) return;\n    updateComposerDraft(composerScopeKey, value);\n    setConfirmedRisk(null);\n  }\n\n  async function handleSend(event: FormEvent<HTMLFormElement>) {\n    event.preventDefault();\n    const profileId = auth.profile?.id ?? null;\n    const conversationId = selectedConversation?.id ?? null;\n    const scopeKey = composerScopeKey;\n    if (\n      !profileId ||\n      !selectedConversation ||\n      !conversationId ||\n      !scopeKey ||\n      sendInFlightScopesRef.current.has(scopeKey)\n    )\n      return;\n    if (selectedConversation.status !== "active") {\n      setNotice(\n        text(\n          "هذه المحادثة محفوظة كسجل ولا تقبل رسائل جديدة.",\n          "This conversation is preserved as history and cannot receive new messages.",\n        ),\n      );\n      return;\n    }\n    const cleanBody = body.trim();\n    if (!cleanBody) return;\n    const safety = analyzeMessageSafety(cleanBody);\n    if (\n      safety.requiresConfirmation &&\n      (confirmedRisk?.scopeKey !== scopeKey || confirmedRisk.body !== cleanBody)\n    ) {\n      setConfirmedRisk({ scopeKey, body: cleanBody });\n      setNotice(\n        text(\n          "تتضمن الرسالة طلب دفع أو بيانات حساسة. راجع التحذير ثم اضغط إرسال مرة ثانية للتأكيد.",\n          "This message mentions payment or sensitive credentials. Review the warning, then press send again to confirm.",\n        ),\n      );\n      return;\n    }\n    const requestId = readOrCreateMessageSendRequestId(profileId, conversationId, cleanBody);\n    sendInFlightScopesRef.current.add(scopeKey);\n    setSendingScopes((current) => new Set(current).add(scopeKey));\n    setNotice("");\n    setMessageError(null);\n    try {\n      const result = await sendConversationMessage(profileId, conversationId, cleanBody, requestId);\n      const stillCurrent =\n        profileIdRef.current === profileId &&\n        selectedConversationIdRef.current === conversationId;\n      if (!result.ok) {\n        if (stillCurrent) setMessageError(result.error);\n        return;\n      }\n      completeMessageSendRequest(profileId, conversationId, requestId);\n      clearComposerDraftIfUnchanged(scopeKey, cleanBody);\n      setConfirmedRisk((current) => (current?.scopeKey === scopeKey ? null : current));\n      if (stillCurrent) {\n        setMessages((current) =>\n          current.some((message) => message.id === result.data.id)\n            ? current\n            : [...current, result.data],\n        );\n        setNotice(text("تم إرسال الرسالة.", "Message sent."));\n      }\n      if (profileIdRef.current === profileId) await loadConversations();\n    } finally {\n      sendInFlightScopesRef.current.delete(scopeKey);\n      setSendingScopes((current) => {\n        const next = new Set(current);\n        next.delete(scopeKey);\n        return next;\n      });\n    }\n  }\n\n  async function handleReport`,
  "scoped send flow",
);

route = replacePattern(
  route,
  /  async function handleReport\(message: ConversationMessage\) \{[\s\S]*?\n  \}\n\n  async function handleBlock/,
  `  async function handleReport(message: ConversationMessage) {\n    const profileId = auth.profile?.id ?? null;\n    const conversationId = selectedConversation?.id ?? null;\n    if (!profileId || !conversationId || reportInFlightRef.current.has(message.id)) return;\n    reportInFlightRef.current.add(message.id);\n    setReportingMessageId(message.id);\n    setNotice("");\n    try {\n      const result = await createMessageReport({\n        messageId: message.id,\n        conversationId,\n        reporterUserId: profileId,\n        reason: "abusive_or_suspicious",\n      });\n      if (\n        profileIdRef.current !== profileId ||\n        selectedConversationIdRef.current !== conversationId\n      )\n        return;\n      setNotice(\n        result.ok\n          ? text("تم إرسال بلاغ الرسالة للمراجعة.", "Message report sent for review.")\n          : result.error.message,\n      );\n    } finally {\n      reportInFlightRef.current.delete(message.id);\n      setReportingMessageId((current) => (current === message.id ? null : current));\n    }\n  }\n\n  async function handleBlock`,
  "scoped report flow",
);

route = replacePattern(
  route,
  /  async function handleBlock\(\) \{[\s\S]*?\n  \}\n\n  function openFirstAvailableConversation/,
  `  async function handleBlock() {\n    const profileId = auth.profile?.id ?? null;\n    const conversationId = selectedConversation?.id ?? null;\n    const blockedUserId = selectedConversation?.otherParticipant.userId ?? null;\n    const reason = blockReason || null;\n    if (!profileId || !conversationId || !blockedUserId || blockInFlightRef.current) return;\n    if (\n      !confirm(text("حظر هذا المستخدم في هذه المحادثة؟", "Block this user in this conversation?"))\n    )\n      return;\n    blockInFlightRef.current = true;\n    setNotice("");\n    try {\n      const result = await blockConversationParticipant({\n        conversationId,\n        blockerUserId: profileId,\n        blockedUserId,\n        reason,\n      });\n      const stillCurrent =\n        profileIdRef.current === profileId &&\n        selectedConversationIdRef.current === conversationId;\n      if (stillCurrent) {\n        setNotice(\n          result.ok\n            ? text(\n                "تم حظر المحادثة. لن تقبل رسائل جديدة.",\n                "Conversation blocked. New messages are no longer allowed.",\n              )\n            : result.error.message,\n        );\n      }\n      if (result.ok && profileIdRef.current === profileId) await loadConversations();\n    } finally {\n      blockInFlightRef.current = false;\n    }\n  }\n\n  function openFirstAvailableConversation`,
  "scoped block flow",
);

route = replaceOnce(
  route,
  `                              setBody(language === "ar" ? reply.ar : reply.en);\n                              setConfirmedRiskBody(null);`,
  `                              setCurrentComposerBody(language === "ar" ? reply.ar : reply.en);`,
  "scoped quick replies",
);

route = replaceOnce(
  route,
  `                        setBody(event.target.value);\n                        setConfirmedRiskBody(null);`,
  `                        setCurrentComposerBody(event.target.value);`,
  "scoped composer input",
);

route = replaceOnce(
  route,
  `messageSafety.requiresConfirmation && confirmedRiskBody === body.trim()`,
  `messageSafety.requiresConfirmation &&\n                            confirmedRisk?.scopeKey === composerScopeKey &&\n                            confirmedRisk.body === body.trim()`,
  "scoped confirmation label",
);

writeFileSync(routePath, route);

const packagePath = "package.json";
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const scopeTest = "scripts/chat-composer-scope-isolation.test.mjs";
if (!packageJson.scripts["test:chat-workspace"].includes(scopeTest)) {
  packageJson.scripts["test:chat-workspace"] += ` ${scopeTest}`;
}
writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

console.log("Chat composer scope isolation applied.");
