import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  messagingSource,
  chatIntegritySource,
  requestSource,
  routeSource,
  migrationSource,
  ledgerSource,
  packageSource,
] = await Promise.all([
  readFile(new URL("../src/lib/api/messaging.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/chat-integrity.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/message-send-request.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../supabase/migrations/202607140003_idempotent_message_send.sql", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../docs/production-schema/migration-ledger.json", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("the database makes one client message request idempotent", () => {
  assert.match(migrationSource, /add column if not exists client_request_id uuid/);
  assert.match(
    migrationSource,
    /on public\.conversation_messages \(sender_user_id, client_request_id\)/,
  );
  assert.match(migrationSource, /rawaj_send_conversation_message_v2/);
  assert.match(migrationSource, /message_request_payload_mismatch/);
  assert.match(migrationSource, /when unique_violation/);
  assert.match(
    migrationSource,
    /grant execute on function public\.rawaj_send_conversation_message_v2\(uuid, uuid, text\) to authenticated/,
  );
  assert.match(migrationSource, /notify pgrst, 'reload schema'/);
});

test("the client sends only through the server-idempotent RPC", () => {
  assert.match(messagingSource, /requestId: string/);
  assert.match(messagingSource, /MESSAGE_REQUEST_UUID_PATTERN/);
  assert.match(messagingSource, /rawaj_send_conversation_message_v2/);
  assert.match(messagingSource, /p_client_request_id: clientRequestId/);
  assert.match(messagingSource, /isMissingMessageSendV2/);
  assert.match(messagingSource, /code: "setup_required"/);
  assert.doesNotMatch(messagingSource, /\.from\("conversation_messages"\)[\s\S]{0,160}\.insert/);
  assert.match(
    messagingSource,
    /JSON\.stringify\(\[actorResult\.data, cleanConversationId, cleanRequestId\]\)/,
  );
});

test("a failed or ambiguous browser attempt reuses its request UUID after reload", () => {
  assert.match(requestSource, /rawaj:message-send-request:v1/);
  assert.match(requestSource, /window\.sessionStorage/);
  assert.match(requestSource, /existing && existing\.body === cleanBody/);
  assert.match(requestSource, /return existing\.requestId/);
  assert.match(requestSource, /MESSAGE_SEND_MAX_AGE_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(requestSource, /completeMessageSendRequest/);
});

test("canonical messages merge by id with deterministic ordering", () => {
  assert.match(chatIntegritySource, /function mergeConversationMessages/);
  assert.match(chatIntegritySource, /new Map<string, ConversationMessage>/);
  assert.match(chatIntegritySource, /left\.createdAt\.localeCompare\(right\.createdAt\)/);
  assert.match(chatIntegritySource, /left\.id\.localeCompare\(right\.id\)/);
});

test("the chat route reuses one attempt and deduplicates rendered rows", () => {
  assert.match(routeSource, /readOrCreateMessageSendRequestId/);
  assert.match(routeSource, /sendConversationMessage\(\{[\s\S]*body: cleanBody,[\s\S]*requestId/);
  assert.match(
    routeSource,
    /mergeConversationMessages\(current, \[result\.data\], conversationId\)/,
  );
});

test("the migration and contract are permanently registered", () => {
  const ledger = JSON.parse(ledgerSource);
  assert.ok(ledger.classifications.canonical.includes("202607140003_idempotent_message_send.sql"));
  const packageJson = JSON.parse(packageSource);
  assert.match(packageJson.scripts["test:chat-workspace"], /message-send-idempotency\.test\.mjs/);
});
