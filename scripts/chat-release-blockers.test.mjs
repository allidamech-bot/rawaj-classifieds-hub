import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [types, messaging, guarded, attachment, chats, css, migration, ledger] = await Promise.all([
  readFile(new URL("../src/lib/classifieds-types.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/messaging.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/messaging-guarded.ts", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/communication/ChatVoiceAttachment.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/communication-center-v2.css", import.meta.url), "utf8"),
  readFile(
    new URL("../supabase/migrations/202607180001_chat_delivery_read_receipts.sql", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../docs/production-schema/migration-ledger.json", import.meta.url), "utf8"),
]);

test("private voice playback retries signed URLs through authenticated downloads", () => {
  assert.match(messaging, /downloadChatAudioObjectUrl/);
  assert.match(messaging, /conversation-audio/);
  assert.match(messaging, /\.download\(path\)/);
  assert.match(guarded, /downloadChatAudioObjectUrl/);
  assert.match(attachment, /resolveUrl\(true\)/);
  assert.match(attachment, /private-download/);
  assert.match(attachment, /URL\.revokeObjectURL/);
});

test("conversation projection exposes the other participant read watermark", () => {
  assert.match(types, /otherLastReadAt: string \| null/);
  assert.match(messaging, /other_last_read_at/);
  assert.match(migration, /other_last_read_at timestamptz/);
  assert.match(migration, /seller_last_read_at/);
  assert.match(migration, /buyer_last_read_at/);
  assert.match(migration, /listing_title_snapshot/);
  assert.match(chats, /data-message-state/);
  assert.match(chats, /مقروءة/);
  assert.match(chats, /تم التسليم/);
});

test("mobile chat starts with the workspace instead of the oversized communication hero", () => {
  assert.match(chats, /className="hidden lg:block"/);
  assert.match(css, /keep the mobile conversation workspace above the fold/);
  assert.match(css, /calc\(100dvh - 9\.5rem\)/);
});

test("migration is registered as forward-only reconciliation work", () => {
  assert.match(ledger, /202607180001_chat_delivery_read_receipts\.sql/);
  assert.match(migration, /Apply manually to Supabase Production after review/);
  assert.match(migration, /to authenticated/);
  assert.doesNotMatch(migration, /grant execute[\s\S]{0,100}to anon/);
});
