import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("chat frontend has no Supabase transport or retired storage buckets", async () => {
  const source = await read("src/lib/api/messaging.ts");
  assert.doesNotMatch(source, /@supabase|\bgetClient\b|\.rpc\(|\.from\(|conversation-images|conversation-audio/);
  assert.match(source, /cloudflareApiRequest/);
  assert.match(source, /cloudflareAuthorizedFetch/);
});

test("chat image and audio upload through authenticated Worker and R2 contracts", async () => {
  const frontend = await read("src/lib/api/messaging.ts");
  const worker = await read("cloudflare/worker/src/account-social.ts");
  assert.match(frontend, /\/attachments/);
  assert.match(frontend, /kind", "image"/);
  assert.match(frontend, /kind", "audio"/);
  assert.match(worker, /env\.MEDIA\.put/);
  assert.match(worker, /matchesImageSignature/);
  assert.match(worker, /matchesAudioSignature/);
  assert.match(worker, /private, no-store/);
});

test("chat media is private to conversation participants", async () => {
  const worker = await read("cloudflare/worker/src/account-social.ts");
  assert.match(worker, /JOIN conversations c ON c\.id = cm\.conversation_id/);
  assert.match(worker, /c\.buyer_id = \? OR c\.seller_id = \?/);
  assert.ok(worker.includes("chat-media"));
  assert.doesNotMatch(worker, /public, max-age=31536000[^\n]*chat/);
});

test("chat media can only be linked once and message send remains idempotent", async () => {
  const worker = await read("cloudflare/worker/src/account-social.ts");
  const migration = await read("cloudflare/d1/migrations/0008_chat_media_and_moderation.sql");
  assert.match(worker, /linked_message_id IS NULL/);
  assert.match(worker, /client_request_id/);
  assert.match(migration, /UNIQUE \(uploader_id, client_request_id\)/);
  assert.match(migration, /idx_conversation_messages_sender_request/);
});

test("message reports and blocking are Cloudflare-owned and authorization-gated", async () => {
  const frontend = await read("src/lib/api/messaging.ts");
  const worker = await read("cloudflare/worker/src/account-social.ts");
  const entry = await read("cloudflare/worker/src/entry.ts");
  assert.match(frontend, /\/messages\/\$\{encodeURIComponent\(messageId\)\}\/report/);
  assert.match(frontend, /\/block/);
  assert.match(worker, /message_reports/);
  assert.match(worker, /user_blocks/);
  assert.match(worker, /hasAdminRole\(auth\.roles\)/);
  assert.ok(entry.includes("message-reports"));
});

test("D1 schema supports audio, private chat assets, and moderation", async () => {
  const migration = await read("cloudflare/d1/migrations/0008_chat_media_and_moderation.sql");
  assert.match(migration, /'audio'/);
  assert.match(migration, /CREATE TABLE chat_media_assets/);
  assert.match(migration, /CREATE TABLE message_reports/);
  assert.match(migration, /FOREIGN KEY \(asset_id\) REFERENCES media_assets/);
});
