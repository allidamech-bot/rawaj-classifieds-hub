import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [api, messaging, reviews] = await Promise.all([
  readFile(new URL("../src/lib/classifieds-api.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/messaging-guarded.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/reviews-guarded.ts", import.meta.url), "utf8"),
]);

test("classifieds API routes communication and seller review writes through guarded modules", () => {
  assert.match(api, /messaging-guarded/);
  assert.match(api, /reviews-guarded/);
  assert.match(messaging, /pendingConversationStarts/);
  assert.match(messaging, /pendingMessageReports/);
  assert.match(messaging, /pendingParticipantBlocks/);
  assert.match(reviews, /pendingReviewCreates/);
  assert.match(reviews, /pendingReviewResponses/);
});
