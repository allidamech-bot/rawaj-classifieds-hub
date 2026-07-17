import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [migration, ledger] = await Promise.all([
  readFile(
    new URL("../supabase/migrations/202607170008_chat_voice_messages_v1.sql", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../docs/production-schema/migration-ledger.json", import.meta.url), "utf8"),
]);

test("voice messages use private participant-only storage", () => {
  assert.match(migration, /'conversation-audio'/);
  assert.match(migration, /public, file_size_limit, allowed_mime_types/);
  assert.match(migration, /false,\s*10485760/);
  assert.match(migration, /conversation_audio_participant_read/);
  assert.match(migration, /rawaj_is_conversation_participant/);
  assert.match(migration, /split_part\(name, '\/', 2\) = auth\.uid\(\)::text/);
});

test("voice metadata is bounded and complete", () => {
  assert.match(migration, /attachment_kind text/);
  assert.match(migration, /attachment_duration_ms integer/);
  assert.match(migration, /attachment_kind = 'audio'/);
  assert.match(migration, /attachment_duration_ms between 1000 and 120000/);
  assert.match(migration, /attachment_size_bytes between 1 and 10485760/);
  assert.match(migration, /audio\/webm/);
  assert.match(migration, /audio\/mp4/);
  assert.match(migration, /audio\/mpeg/);
  assert.match(migration, /audio\/ogg/);
});

test("v4 remains server-authoritative and idempotent", () => {
  assert.match(migration, /rawaj_send_conversation_message_v4/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /storage\.objects/);
  assert.match(migration, /message_request_payload_mismatch/);
  assert.match(migration, /when unique_violation/);
  assert.match(migration, /grant execute[\s\S]*to authenticated/);
  assert.doesNotMatch(migration, /to anon;/);
});

test("voice migration is registered as forward-only reconciliation", () => {
  const parsed = JSON.parse(ledger);
  assert.ok(
    parsed.classifications.reconciliation.includes(
      "202607170008_chat_voice_messages_v1.sql",
    ),
  );
});
