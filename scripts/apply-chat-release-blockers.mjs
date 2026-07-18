import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const current = await readFile(path, "utf8");
  if (!current.includes(before)) {
    throw new Error(`Expected patch anchor was not found in ${path}: ${before.slice(0, 80)}`);
  }
  const next = current.replace(before, after);
  await writeFile(path, next);
}

await replaceOnce(
  "src/lib/classifieds-types.ts",
  `  unreadCount: number;\n  createdAt: string;`,
  `  unreadCount: number;\n  otherLastReadAt: string | null;\n  createdAt: string;`,
);

await replaceOnce(
  "src/lib/api/messaging.ts",
  `export async function createChatAudioSignedUrl(path: string): Promise<string | null> {\n  if (!path) return null;\n  const clientResult = getClient();\n  if (!clientResult.ok) return null;\n  const { data, error } = await clientResult.data.storage\n    .from("conversation-audio")\n    .createSignedUrl(path, 15 * 60);\n  return error ? null : data.signedUrl;\n}\n`,
  `export async function createChatAudioSignedUrl(path: string): Promise<string | null> {\n  if (!path) return null;\n  const clientResult = getClient();\n  if (!clientResult.ok) return null;\n  const { data, error } = await clientResult.data.storage\n    .from("conversation-audio")\n    .createSignedUrl(path, 15 * 60);\n  return error ? null : data.signedUrl;\n}\n\nexport async function downloadChatAudioObjectUrl(path: string): Promise<string | null> {\n  if (!path || typeof URL === "undefined") return null;\n  const clientResult = getClient();\n  if (!clientResult.ok) return null;\n  const { data, error } = await clientResult.data.storage.from("conversation-audio").download(path);\n  if (error || !data) return null;\n  return URL.createObjectURL(data);\n}\n`,
);

await replaceOnce(
  "src/lib/api/messaging.ts",
  `    unreadCount: rowNumber(row, "unread_count"),\n    createdAt: rowString(row, "created_at"),`,
  `    unreadCount: rowNumber(row, "unread_count"),\n    otherLastReadAt: rowNullableString(row, "other_last_read_at"),\n    createdAt: rowString(row, "created_at"),`,
);

await replaceOnce(
  "src/lib/api/messaging-guarded.ts",
  `  createChatAudioSignedUrl,\n  createChatImageSignedUrl,`,
  `  createChatAudioSignedUrl,\n  createChatImageSignedUrl,\n  downloadChatAudioObjectUrl,`,
);
await replaceOnce(
  "src/lib/api/messaging-guarded.ts",
  `  createChatAudioSignedUrl,\n  createChatImageSignedUrl,\n  createMessageReport,`,
  `  createChatAudioSignedUrl,\n  createChatImageSignedUrl,\n  downloadChatAudioObjectUrl,\n  createMessageReport,`,
);

await writeFile(
  "src/features/communication/ChatVoiceAttachment.tsx",
  `import { RefreshCw, Volume2 } from "lucide-react";\nimport { useCallback, useEffect, useRef, useState } from "react";\nimport { createChatAudioSignedUrl, downloadChatAudioObjectUrl } from "@/lib/classifieds-api";\n\ninterface ChatVoiceAttachmentProps {\n  attachmentPath: string;\n  initialUrl: string | null;\n  durationMs: number | null;\n  retryLabel: string;\n  unavailableLabel: string;\n}\n\nexport function ChatVoiceAttachment({\n  attachmentPath,\n  initialUrl,\n  durationMs,\n  retryLabel,\n  unavailableLabel,\n}: ChatVoiceAttachmentProps) {\n  const [url, setUrl] = useState(initialUrl);\n  const [loading, setLoading] = useState(!initialUrl);\n  const [failed, setFailed] = useState(false);\n  const mountedRef = useRef(true);\n  const loadingRef = useRef(false);\n  const ownedObjectUrlRef = useRef<string | null>(null);\n\n  const releaseOwnedUrl = useCallback(() => {\n    if (ownedObjectUrlRef.current) URL.revokeObjectURL(ownedObjectUrlRef.current);\n    ownedObjectUrlRef.current = null;\n  }, []);\n\n  useEffect(() => {\n    mountedRef.current = true;\n    return () => {\n      mountedRef.current = false;\n      releaseOwnedUrl();\n    };\n  }, [releaseOwnedUrl]);\n\n  const resolveUrl = useCallback(\n    async (preferDownload = false) => {\n      if (!attachmentPath || loadingRef.current) return;\n      loadingRef.current = true;\n      if (mountedRef.current) {\n        setLoading(true);\n        setFailed(false);\n      }\n\n      let next = preferDownload ? null : await createChatAudioSignedUrl(attachmentPath);\n      let ownsNext = false;\n      if (!next) {\n        next = await downloadChatAudioObjectUrl(attachmentPath);\n        ownsNext = Boolean(next);\n      }\n\n      if (!mountedRef.current) {\n        if (ownsNext && next) URL.revokeObjectURL(next);\n        loadingRef.current = false;\n        return;\n      }\n\n      releaseOwnedUrl();\n      if (ownsNext && next) ownedObjectUrlRef.current = next;\n      setUrl(next);\n      setFailed(!next);\n      setLoading(false);\n      loadingRef.current = false;\n    },\n    [attachmentPath, releaseOwnedUrl],\n  );\n\n  useEffect(() => {\n    releaseOwnedUrl();\n    setUrl(initialUrl);\n    setFailed(false);\n    setLoading(!initialUrl);\n    loadingRef.current = false;\n    if (!initialUrl) void resolveUrl();\n  }, [attachmentPath, initialUrl, releaseOwnedUrl, resolveUrl]);\n\n  async function handleError() {\n    await resolveUrl(true);\n  }\n\n  if (!url) {\n    return (\n      <div className="mb-2 rounded-xl bg-black/5 p-3">\n        <div className="flex items-center gap-2 text-xs text-muted-foreground">\n          <Volume2 className="h-4 w-4" aria-hidden="true" />\n          <span>{loading ? retryLabel : unavailableLabel}</span>\n        </div>\n        <button\n          type="button"\n          onClick={() => void resolveUrl()}\n          disabled={loading}\n          className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg bg-muted-surface px-3 text-xs font-bold text-primary hairline"\n        >\n          <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />\n          {retryLabel}\n        </button>\n      </div>\n    );\n  }\n\n  return (\n    <div className="mb-2 rounded-xl bg-black/5 p-2" data-audio-source={ownedObjectUrlRef.current ? "private-download" : "signed-url"}>\n      <audio\n        controls\n        preload="metadata"\n        src={url}\n        onError={() => void handleError()}\n        className="w-full"\n      />\n      {durationMs ? (\n        <p className="mt-1 text-[10px] text-muted-foreground">{Math.ceil(durationMs / 1000)}s</p>\n      ) : null}\n      {failed ? <span className="sr-only">{unavailableLabel}</span> : null}\n    </div>\n  );\n}\n`,
);

await replaceOnce(
  "src/routes/chats.tsx",
  `        <CommunicationCenterHero\n          mode="messages"\n          unreadMessages={accountConversations.reduce(\n            (total, conversation) => total + conversation.unreadCount,\n            0,\n          )}\n          conversationCount={accountConversations.length}\n        />\n        <CommunicationSafetyNote />`,
  `        <div className="hidden lg:block">\n          <CommunicationCenterHero\n            mode="messages"\n            unreadMessages={accountConversations.reduce(\n              (total, conversation) => total + conversation.unreadCount,\n              0,\n            )}\n            conversationCount={accountConversations.length}\n          />\n        </div>\n        <div className="hidden lg:block">\n          <CommunicationSafetyNote />\n        </div>`,
);

await replaceOnce(
  "src/routes/chats.tsx",
  `                          <p className="rawaj-message-bubble__time">\n                            {formatDateTime(message.createdAt, language)}\n                          </p>`,
  `                          <p className="rawaj-message-bubble__time">\n                            {formatDateTime(message.createdAt, language)}\n                            {mine ? (\n                              <span\n                                className="ms-1 font-bold"\n                                data-message-state={\n                                  selectedConversation.otherLastReadAt &&\n                                  Date.parse(selectedConversation.otherLastReadAt) >=\n                                    Date.parse(message.createdAt)\n                                    ? "read"\n                                    : "delivered"\n                                }\n                              >\n                                {" · "}\n                                {selectedConversation.otherLastReadAt &&\n                                Date.parse(selectedConversation.otherLastReadAt) >=\n                                  Date.parse(message.createdAt)\n                                  ? text("مقروءة", "Read")\n                                  : text("تم التسليم", "Delivered")}\n                              </span>\n                            ) : null}\n                          </p>`,
);

const communicationCssPath = "src/communication-center-v2.css";
const communicationCss = await readFile(communicationCssPath, "utf8");
const chatMobileMarker = "/* RAWAJ chat release blocker: keep the mobile conversation workspace above the fold. */";
if (!communicationCss.includes(chatMobileMarker)) {
  await writeFile(
    communicationCssPath,
    `${communicationCss.trimEnd()}\n\n${chatMobileMarker}\n@media (max-width: 1023px) {\n  .rawaj-communication-v2--messages {\n    padding-top: 0.35rem;\n  }\n\n  .rawaj-communication-v2--messages .rawaj-message-workspace {\n    min-height: calc(100dvh - 9.5rem);\n  }\n}\n`,
  );
}

const migrationName = "202607180001_chat_delivery_read_receipts.sql";
await writeFile(
  `supabase/migrations/${migrationName}`,
  `-- RAWAJ chat delivery/read receipt projection.\n-- Forward-only migration. Apply manually to Supabase Production after review.\n\ndrop function if exists public.rawaj_fetch_my_conversations();\n\ncreate function public.rawaj_fetch_my_conversations()\nreturns table (\n  id uuid,\n  listing_id uuid,\n  listing_title text,\n  buyer_user_id uuid,\n  seller_user_id uuid,\n  status text,\n  other_user_id uuid,\n  other_display_name text,\n  other_avatar_url text,\n  other_governorate text,\n  last_message_at timestamptz,\n  last_message_preview text,\n  unread_count integer,\n  other_last_read_at timestamptz,\n  created_at timestamptz,\n  updated_at timestamptz\n)\nlanguage sql\nstable\nsecurity definer\nset search_path = public\nas $$\n  select\n    c.id,\n    c.listing_id,\n    coalesce(l.title, c.listing_title_snapshot, 'إعلان محذوف') as listing_title,\n    c.buyer_user_id,\n    c.seller_user_id,\n    c.status,\n    case when auth.uid() = c.buyer_user_id then c.seller_user_id else c.buyer_user_id end,\n    coalesce(other_profile.display_name, 'مستخدم رواج'),\n    other_profile.avatar_url,\n    other_profile.governorate,\n    c.last_message_at,\n    c.last_message_preview,\n    (\n      select count(*)::integer\n      from public.conversation_messages m\n      where m.conversation_id = c.id\n        and m.sender_user_id <> auth.uid()\n        and m.deleted_at is null\n        and m.created_at > coalesce(\n          case\n            when auth.uid() = c.buyer_user_id then c.buyer_last_read_at\n            else c.seller_last_read_at\n          end,\n          '-infinity'::timestamptz\n        )\n    ),\n    case\n      when auth.uid() = c.buyer_user_id then c.seller_last_read_at\n      else c.buyer_last_read_at\n    end,\n    c.created_at,\n    c.updated_at\n  from public.conversations c\n  left join public.listings l on l.id = c.listing_id\n  left join public.profiles other_profile\n    on other_profile.id = case\n      when auth.uid() = c.buyer_user_id then c.seller_user_id\n      else c.buyer_user_id\n    end\n  where auth.uid() in (c.buyer_user_id, c.seller_user_id)\n  order by coalesce(c.last_message_at, c.updated_at, c.created_at) desc;\n$$;\n\nrevoke all on function public.rawaj_fetch_my_conversations() from public;\nrevoke all on function public.rawaj_fetch_my_conversations() from anon;\ngrant execute on function public.rawaj_fetch_my_conversations() to authenticated;\n\ncomment on function public.rawaj_fetch_my_conversations() is\n  'Returns participant-relative conversation summaries including the other participant read watermark.';\n\nnotify pgrst, 'reload schema';\n`,
);

const ledgerPath = "docs/production-schema/migration-ledger.json";
const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
const reconciliation = ledger.classifications.reconciliation;
if (!reconciliation.includes(migrationName)) reconciliation.push(migrationName);
await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);

await writeFile(
  "scripts/chat-release-blockers.test.mjs",
  `import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport test from "node:test";\n\nconst [types, messaging, guarded, attachment, chats, css, migration, ledger] = await Promise.all([\n  readFile(new URL("../src/lib/classifieds-types.ts", import.meta.url), "utf8"),\n  readFile(new URL("../src/lib/api/messaging.ts", import.meta.url), "utf8"),\n  readFile(new URL("../src/lib/api/messaging-guarded.ts", import.meta.url), "utf8"),\n  readFile(new URL("../src/features/communication/ChatVoiceAttachment.tsx", import.meta.url), "utf8"),\n  readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),\n  readFile(new URL("../src/communication-center-v2.css", import.meta.url), "utf8"),\n  readFile(new URL("../supabase/migrations/202607180001_chat_delivery_read_receipts.sql", import.meta.url), "utf8"),\n  readFile(new URL("../docs/production-schema/migration-ledger.json", import.meta.url), "utf8"),\n]);\n\ntest("private voice playback retries signed URLs through authenticated downloads", () => {\n  assert.match(messaging, /downloadChatAudioObjectUrl/);\n  assert.match(messaging, /conversation-audio/);\n  assert.match(messaging, /\\.download\\(path\\)/);\n  assert.match(guarded, /downloadChatAudioObjectUrl/);\n  assert.match(attachment, /resolveUrl\\(true\\)/);\n  assert.match(attachment, /private-download/);\n  assert.match(attachment, /URL\\.revokeObjectURL/);\n});\n\ntest("conversation projection exposes the other participant read watermark", () => {\n  assert.match(types, /otherLastReadAt: string \\| null/);\n  assert.match(messaging, /other_last_read_at/);\n  assert.match(migration, /other_last_read_at timestamptz/);\n  assert.match(migration, /seller_last_read_at/);\n  assert.match(migration, /buyer_last_read_at/);\n  assert.match(migration, /listing_title_snapshot/);\n  assert.match(chats, /data-message-state/);\n  assert.match(chats, /مقروءة/);\n  assert.match(chats, /تم التسليم/);\n});\n\ntest("mobile chat starts with the workspace instead of the oversized communication hero", () => {\n  assert.match(chats, /className="hidden lg:block"/);\n  assert.match(css, /keep the mobile conversation workspace above the fold/);\n  assert.match(css, /calc\\(100dvh - 9\\.5rem\\)/);\n});\n\ntest("migration is registered as forward-only reconciliation work", () => {\n  assert.match(ledger, /202607180001_chat_delivery_read_receipts\\.sql/);\n  assert.match(migration, /Apply manually to Supabase Production after review/);\n  assert.match(migration, /to authenticated/);\n  assert.doesNotMatch(migration, /grant execute[\\s\\S]{0,100}to anon/);\n});\n`,
);

await writeFile(
  ".github/workflows/chat-release-blockers.yml",
  `name: Chat Release Blockers\n\non:\n  pull_request:\n    branches: [main]\n    paths:\n      - "src/features/communication/ChatVoiceAttachment.tsx"\n      - "src/lib/api/messaging.ts"\n      - "src/lib/api/messaging-guarded.ts"\n      - "src/lib/classifieds-types.ts"\n      - "src/routes/chats.tsx"\n      - "src/communication-center-v2.css"\n      - "supabase/migrations/202607180001_chat_delivery_read_receipts.sql"\n      - "docs/production-schema/migration-ledger.json"\n      - "scripts/chat-release-blockers.test.mjs"\n      - ".github/workflows/chat-release-blockers.yml"\n  workflow_dispatch:\n\npermissions:\n  contents: read\n\njobs:\n  contract:\n    runs-on: ubuntu-latest\n    timeout-minutes: 15\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n          cache: npm\n      - run: npm ci\n      - run: node --test scripts/chat-release-blockers.test.mjs\n      - run: npx eslint --quiet src/features/communication/ChatVoiceAttachment.tsx src/lib/api/messaging.ts src/lib/api/messaging-guarded.ts src/lib/classifieds-types.ts src/routes/chats.tsx\n      - run: node scripts/check-migration-ledger.mjs\n      - run: npm run typecheck -- --pretty false\n`,
);
