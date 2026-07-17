import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  api,
  route,
  liveHook,
  types,
  helperSource,
  startSql,
  sendSql,
  reportSql,
  blockSql,
  realtimeSql,
  workflow,
  qualityGate,
  packageSource,
] = await Promise.all([
  read("src/lib/api/messaging.ts"),
  read("src/routes/chats.tsx"),
  read("src/features/communication/useLiveChatWorkspace.ts"),
  read("src/lib/classifieds-types.ts"),
  read("src/lib/chat-integrity.ts"),
  read("supabase/migrations/202607100003_align_conversation_start_visibility.sql"),
  read("supabase/migrations/202607140003_idempotent_message_send.sql"),
  read("supabase/migrations/202607080008_message_report_idempotency.sql"),
  read("supabase/migrations/202607080007_conversation_block_idempotency.sql"),
  read("supabase/migrations/202607160003_enable_chat_realtime.sql"),
  read(".github/workflows/conversations-messaging-realtime-integrity.yml"),
  read(".github/workflows/quality-gate.yml"),
  read("package.json"),
]);

const helperJs = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const helper = await import(
  `data:text/javascript;base64,${Buffer.from(helperJs).toString("base64")}`
);

test("public communication APIs are actor-free and authenticate server-side", () => {
  const publicApi = api.slice(0, api.indexOf("export function fromDbMessageReportStatus"));
  assert.match(api, /function fetchMyConversations\(\)/);
  assert.match(api, /function fetchConversationMessages\(\s*conversationId: string/);
  assert.match(api, /function markConversationRead\(\s*conversationId: string/);
  assert.match(
    api,
    /sendConversationMessage\(payload: \{[\s\S]{0,120}conversationId: string;[\s\S]{0,80}body: string;[\s\S]{0,80}requestId: string;/,
  );
  assert.match(api, /function startListingConversation\([\s\S]{0,40}listingId: string/);
  assert.doesNotMatch(api, /export async function fetchMyConversations\([\s\S]{0,80}userId/);
  assert.doesNotMatch(publicApi, /reporterUserId|blockerUserId|payload\.blockedUserId/);
  assert.match(api, /createMessageReport\([\s\S]{0,100}ClassifiedsResult<null>/);
  assert.match(api, /client\.auth\.getUser\(\)/);
  assert.match(types, /interface ConversationMessage \{[\s\S]*isMine: boolean/);
  assert.doesNotMatch(types, /interface ConversationMessage \{[\s\S]{0,160}senderUserId/);
});

test("conversation creation and reads remain participant-only and canonical", () => {
  assert.match(startSql, /auth\.uid\(\)/);
  assert.match(startSql, /listing_owner = auth\.uid\(\)/);
  assert.match(startSql, /Users cannot message themselves/);
  assert.match(startSql, /listing_status <> 'approved'/);
  assert.match(startSql, /rawaj_start_listing_conversation/);
  assert.match(startSql, /ON CONFLICT|unique_violation|pg_advisory_xact_lock/i);
  assert.match(api, /rpc\("rawaj_fetch_my_conversations"\)/);
  assert.match(api, /\.eq\("conversation_id", cleanConversationId\)/);
  assert.match(api, /\.limit\(CHAT_HISTORY_PAGE_SIZE\)/);
  assert.match(
    api,
    /select\("id,conversation_id,sender_user_id,body,created_at,edited_at,deleted_at"\)/,
  );
  assert.doesNotMatch(api, /from\("conversation_messages"\)[\s\S]{0,100}\.select\("\*"\)/);
});

test("message sending is validated, server-idempotent and conversation scoped", () => {
  assert.match(api, /cleanBody\.length < 1/);
  assert.match(api, /cleanBody\.length > CHAT_MESSAGE_MAX_LENGTH/);
  assert.match(
    api,
    /JSON\.stringify\(\[actorResult\.data, cleanConversationId, cleanRequestId\]\)/,
  );
  assert.match(api, /rawaj_send_conversation_message_v2/);
  assert.doesNotMatch(api, /\.from\("conversation_messages"\)[\s\S]{0,160}\.insert/);
  assert.match(sendSql, /auth\.uid\(\)/);
  assert.match(sendSql, /client_request_id/);
  assert.match(sendSql, /message_request_payload_mismatch/);
  assert.match(sendSql, /unique_violation/);
  assert.match(sendSql, /sender_user_id = v_actor/);
  assert.match(route, /<p className="whitespace-pre-line break-words">\{message\.body\}<\/p>/);
  assert.doesNotMatch(route, /dangerouslySetInnerHTML/);
});

test("pure merge helpers reject cross-conversation rows and order stable ties", () => {
  const message = (id, conversationId, createdAt) => ({
    id,
    conversationId,
    isMine: false,
    body: id,
    createdAt,
    editedAt: null,
    deletedAt: null,
  });
  const result = helper.mergeConversationMessages(
    [message("b", "c1", "2026-01-01T00:00:00Z")],
    [
      message("a", "c1", "2026-01-01T00:00:00Z"),
      message("b", "c1", "2026-01-01T00:00:00Z"),
      message("z", "c2", "2025-01-01T00:00:00Z"),
    ],
    "c1",
  );
  assert.deepEqual(
    result.map(({ id }) => id),
    ["a", "b"],
  );
  assert.equal(helper.CHAT_HISTORY_PAGE_SIZE, 200);
});

test("URL, stale request, draft, and account replacement scopes are isolated", () => {
  assert.match(route, /normalizeChatResourceId/);
  assert.match(route, /accountStateMatches = profileIdRef\.current === liveProfileId/);
  assert.match(route, /resolveConversationTarget\(accountConversations, search\.conversation\)/);
  assert.match(route, /profileId !== profileIdRef\.current/);
  assert.match(route, /conversationId !== selectedConversationIdRef\.current/);
  assert.match(route, /clearComposerDraftIfUnchanged/);
  assert.match(route, /accountGenerationRef\.current === accountGeneration/);
  assert.match(route, /accountGenerationRef\.current !== accountGeneration/);
  assert.match(route, /sendInFlightScopesRef\.current\.clear\(\)/);
  assert.match(route, /reportInFlightRef\.current\.clear\(\)/);
  assert.match(route, /blockInFlightRef\.current\.clear\(\)/);
  assert.match(route, /setConversations\(\[\]\)/);
  assert.match(route, /setMessages\(\[\]\)/);
  assert.match(route, /search: \{\}, replace: true/);
  assert.match(route, /visibleMessages/);
});

test("realtime is authenticated, selected-conversation scoped, stale-safe, and cleaned up", () => {
  assert.match(liveHook, /if \(!signedIn \|\| !profileId/);
  assert.match(liveHook, /rawaj-live-chat:\$\{profileId\}:\$\{selectedConversationId\}/);
  assert.match(liveHook, /filter: `conversation_id=eq\.\$\{selectedConversationId\}`/);
  assert.match(liveHook, /activeScopeRef\.current !== scopeKey/);
  assert.match(liveHook, /row\.conversation_id !== selectedConversationId/);
  assert.match(liveHook, /removeChannel\(channel\)/);
  assert.match(route, /selectedConversation && isConversationPanelVisible/);
  assert.match(route, /!isConversationPanelVisible/);
  assert.match(realtimeSql, /REVOKE SELECT ON TABLE public\.conversation_messages FROM anon/);
  assert.match(realtimeSql, /GRANT SELECT ON TABLE public\.conversation_messages TO authenticated/);
});

test("read, block, and report operations are server-authoritative", () => {
  assert.match(api, /rawaj_mark_conversation_read/);
  assert.match(api, /rawaj_create_message_report/);
  assert.match(api, /select\("id,conversation_id"\)/);
  assert.match(reportSql, /auth\.uid\(\)/);
  assert.match(reportSql, /auth\.uid\(\) is distinct from v_conversation_buyer/);
  assert.match(reportSql, /Only conversation participants can report messages/);
  assert.match(blockSql, /auth\.uid\(\)/);
  assert.match(blockSql, /blocker_user_id/);
  assert.match(blockSql, /blocked_user_id/);
  assert.match(api, /rowString\(conversation, "other_user_id"\)/);
});

test("DTO and workflow boundaries exclude private data and writes", () => {
  const conversationTypes = types.slice(
    types.indexOf("export interface ConversationParticipantSummary"),
    types.indexOf("export interface PublicSellerSearchResult"),
  );
  assert.doesNotMatch(
    conversationTypes,
    /email|phone|governorate|buyerUserId|sellerUserId|senderUserId/,
  );
  assert.match(workflow, /contents: read/);
  assert.doesNotMatch(workflow, /contents: write|service[_-]?role|supabase db|deploy|git push/i);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run test:conversations-messaging-realtime/);
  assert.match(workflow, /npm run typecheck/);
  assert.match(qualityGate, /Conversations, Messaging & Realtime Integrity contract/);
  assert.match(qualityGate, /npm run test:conversations-messaging-realtime/);
  const packageJson = JSON.parse(packageSource);
  assert.equal(packageJson.scripts.precheck, "npm run test:conversations-messaging-realtime");
  assert.ok(packageJson.scripts["test:conversations-messaging-realtime"]);
  assert.doesNotMatch(
    [api, route, liveHook].join("\n"),
    /service_role|navigator\.geolocation|radius/i,
  );
});
