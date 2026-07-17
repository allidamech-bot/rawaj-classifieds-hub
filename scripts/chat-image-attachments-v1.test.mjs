/* eslint-disable */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [migration, api, workflow] = await Promise.all([
  readFile(
    new URL(
      "../supabase/migrations/202607170007_chat_image_attachments_v1.sql",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(new URL("../src/lib/api/chat-image-attachments.ts", import.meta.url), "utf8"),
  readFile(
    new URL("../.github/workflows/chat-image-attachments-v1.yml", import.meta.url),
    "utf8",
  ),
]);

test("chat images use a private bounded bucket and participant policies", () => {
  assert.match(migration, /'conversation-images'/);
  assert.match(migration, /public, file_size_limit, allowed_mime_types/);
  assert.match(migration, /false,[\s\S]*5242880/);
  assert.match(migration, /conversation_images_participant_read/);
  assert.match(migration, /rawaj_is_conversation_participant/);
  assert.match(migration, /split_part\(name, '\/', 2\) = auth\.uid\(\)::text/);
  assert.doesNotMatch(migration, /create policy[\s\S]{0,120}to anon/i);
});

test("message RPC binds attachment paths to conversation, actor and request id", () => {
  assert.match(migration, /rawaj_send_conversation_message_v3/);
  assert.match(migration, /p_attachment_path text default null/);
  assert.match(migration, /p_attachment_size_bytes integer default null/);
  assert.match(migration, /p_conversation_id::text \|\| '\/' \|\| v_actor::text/);
  assert.match(migration, /p_client_request_id::text/);
  assert.match(migration, /message_request_payload_mismatch/);
  assert.match(migration, /when unique_violation/);
  assert.match(migration, /storage\.objects/);
  assert.match(migration, /Chat attachment upload could not be verified/);
  assert.match(migration, /image\/jpeg/);
  assert.match(migration, /image\/png/);
  assert.match(migration, /image\/webp/);
});

test("browser upload validation is explicit and never exposes public URLs", () => {
  assert.match(api, /CHAT_IMAGE_MAX_BYTES = 5 \* 1024 \* 1024/);
  assert.match(api, /image\/jpeg/);
  assert.match(api, /image\/png/);
  assert.match(api, /image\/webp/);
  assert.match(api, /createSignedUrl\(path, 15 \* 60\)/);
  assert.doesNotMatch(api, /getPublicUrl|publicUrl/);
  assert.match(api, /\$\{conversationId\}\/\$\{userId\}\/\$\{requestId\}/);
  assert.match(api, /remove\(\[path\]\)/);
});

test("attachment metadata is complete or fully absent", () => {
  assert.match(migration, /conversation_messages_attachment_metadata_complete/);
  assert.match(
    migration,
    /attachment_path is null[\s\S]*attachment_mime_type is null[\s\S]*attachment_size_bytes is null/,
  );
  assert.match(
    migration,
    /attachment_path is not null[\s\S]*attachment_mime_type in[\s\S]*attachment_size_bytes between 1 and 5242880/,
  );
  assert.match(migration, /Chat attachment metadata is incomplete/);
});

test("migration preserves text-only messages while allowing image-only content", () => {
  assert.match(migration, /alter column body set default ''/);
  assert.match(migration, /conversation_messages_content_required/);
  assert.match(migration, /char_length\(btrim\(body\)\) between 1 and 2000/);
  assert.match(migration, /or attachment_path is not null/);
});

test("permanent workflow is read-only and verifies migration registration", () => {
  assert.match(workflow, /name: Chat Image Attachments V1/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /contents: read/);
  assert.doesNotMatch(workflow, /contents: write/);
  assert.match(workflow, /scripts\/chat-image-attachments-v1\.test\.mjs/);
  assert.match(workflow, /node scripts\/check-migration-ledger\.mjs/);
});