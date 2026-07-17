import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [migration, api, messaging, route, types, workflow, qualityGate] = await Promise.all([
  readFile(new URL("../supabase/migrations/202607170007_chat_image_attachments_v1.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/chat-image-attachments.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/messaging.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/classifieds-types.ts", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/chat-image-attachments-v1.yml", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
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
  assert.match(api, /conversationId\/\$\{userId\}\/\$\{requestId\}/);
});

test("messaging supports text fallback before migration and image cleanup on failure", () => {
  assert.match(messaging, /rawaj_send_conversation_message_v3/);
  assert.match(messaging, /rawaj_send_conversation_message_v2/);
  assert.match(messaging, /attachment\?: UploadedChatImage \| null/);
  assert.match(messaging, /hydrateMessageAttachment/);
  assert.match(route, /uploadChatImage/);
  assert.match(route, /removeChatImage\(uploadedPath\)/);
  assert.match(route, /validateChatImage/);
  assert.match(route, /accept="image\/jpeg,image\/png,image\/webp"/);
});

test("message DTO and UI expose only signed attachment presentation", () => {
  assert.match(types, /attachmentPath: string \| null/);
  assert.match(types, /attachmentUrl: string \| null/);
  assert.match(route, /message\.attachmentUrl/);
  assert.match(route, /rel="noreferrer"/);
  assert.match(route, /PendingChatImage/);
});

test("permanent workflow is read-only and included in the quality gate", () => {
  assert.match(workflow, /name: Chat Image Attachments V1/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /contents: read/);
  assert.doesNotMatch(workflow, /contents: write/);
  assert.match(qualityGate, /name: Chat Image Attachments V1 contract/);
  assert.match(qualityGate, /scripts\/chat-image-attachments-v1\.test\.mjs/);
});
