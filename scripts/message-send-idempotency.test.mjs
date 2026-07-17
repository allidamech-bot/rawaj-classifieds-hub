import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  messagingSource,
  chatIntegritySource,
  requestSource,
  routeSource,
  migrationSource,
  attachmentMigrationSource,
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
  readFile(
    new URL("../supabase/migrations/202607170007_chat_image_attachments_v1.sql", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../docs/production-schema/migration-ledger.json", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("database message requests stay idempotent across v2 and attachment-aware v3", () => {
  assert.match(migrationSource, /client_request_id uuid/);
  assert.match(migrationSource, /sender_user_id, client_request_id/);
  assert.match(migrationSource, /rawaj_send_conversation_message_v2/);
  assert.match(attachmentMigrationSource, /rawaj_send_conversation_message_v3/);
  assert.match(attachmentMigrationSource, /message_request_payload_mismatch/);
  assert.match(attachmentMigrationSource, /unique_violation/);
  assert.match(attachmentMigrationSource, /to authenticated/);
});

test("client sends through the server-authoritative v3 RPC", () => {
  assert.match(messagingSource, /MESSAGE_REQUEST_UUID_PATTERN/);
  assert.match(messagingSource, /rawaj_send_conversation_message_v3/);
  assert.match(messagingSource, /p_client_request_id: clientRequestId/);
  assert.match(messagingSource, /p_attachment_path/);
  assert.match(messagingSource, /isMissingMessageSendV3/);
  assert.doesNotMatch(messagingSource, /\.from\("conversation_messages"\)[\s\S]{0,160}\.insert/);
  assert.match(messagingSource, /pendingMessageSends/);
});

test("ambiguous browser attempts reuse their request UUID", () => {
  assert.match(requestSource, /rawaj:message-send-request:v1/);
  assert.match(requestSource, /sessionStorage/);
  assert.match(requestSource, /existing\.requestId/);
  assert.match(requestSource, /completeMessageSendRequest/);
  assert.match(routeSource, /requestSignature/);
  assert.match(routeSource, /readOrCreateMessageSendRequestId/);
});

test("canonical messages still merge once with deterministic ordering", () => {
  assert.match(chatIntegritySource, /mergeConversationMessages/);
  assert.match(chatIntegritySource, /new Map<string, ConversationMessage>/);
  assert.match(chatIntegritySource, /createdAt\.localeCompare/);
  assert.match(routeSource, /mergeConversationMessages\(current, \[result\.data\], conversationId\)/);
});

test("both migrations and the permanent chat contract remain registered", () => {
  const ledger = JSON.parse(ledgerSource);
  assert.ok(ledger.classifications.canonical.includes("202607140003_idempotent_message_send.sql"));
  assert.ok(ledger.classifications.canonical.includes("202607170007_chat_image_attachments_v1.sql"));
  const packageJson = JSON.parse(packageSource);
  assert.match(packageJson.scripts["test:chat-workspace"], /message-send-idempotency\.test\.mjs/);
});
