import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [route, viewer] = await Promise.all([
  readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/communication/ChatAttachmentImage.tsx", import.meta.url),
    "utf8",
  ),
]);

test("chat route delegates private attachments to the resilient viewer", () => {
  assert.match(route, /ChatAttachmentImage/);
  assert.match(route, /attachmentPath=\{message\.attachmentPath\}/);
  assert.match(route, /initialUrl=\{message\.attachmentUrl\}/);
  assert.doesNotMatch(route, /href=\{message\.attachmentUrl\}/);
});

test("attachment viewer refreshes expired signed URLs and exposes retry state", () => {
  assert.match(viewer, /createChatImageSignedUrl\(attachmentPath\)/);
  assert.match(viewer, /handleImageError/);
  assert.match(viewer, /refreshAttemptRef\.current >= 1/);
  assert.match(viewer, /window\.open\("about:blank", "_blank"\)/);
  assert.match(viewer, /popup\.opener = null/);
  assert.match(viewer, /popup\.location\.replace\(target\)/);
  assert.match(viewer, /unavailableLabel/);
  assert.match(viewer, /retryLabel/);
});
