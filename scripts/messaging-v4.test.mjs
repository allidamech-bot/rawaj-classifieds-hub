import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [root, routeStyles, route, experience, css, packageJson] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/communication/CommunicationExperience.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/messaging-v4.css", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("phase 5 messaging layer is route-scoped and loaded after the communication center", () => {
  assert.match(routeStyles, /messagingV4Css from "\.\.\/messaging-v4\.css\?url"/);
  assert.match(routeStyles, /messagingV4: messagingV4Css/);
  assert.ok(root.indexOf("messagingV4") > root.indexOf("communicationCenterV2"));
  assert.match(route, /rawaj-messaging-v4/);
});

test("conversation cards expose useful time context without changing realtime behavior", () => {
  assert.match(experience, /dateLabel: string/);
  assert.match(experience, /<time>\{dateLabel\}<\/time>/);
  assert.match(route, /formatConversationTime\(conversation\.lastMessageAt, language\)/);
  assert.match(route, /useLiveChatWorkspace/);
});

test("messages retain one page heading and accessible interaction contracts", () => {
  assert.match(experience, /mode === "messages" \? "h2" : "h1"/);
  assert.match(route, /aria-label=\{text\([^)]*"Write a message\.\.\."/s);
  assert.match(route, /aria-label=\{text\([^)]*"Attach image"/s);
  assert.match(route, /aria-label=\{text\([^)]*"Share location"/s);
});

test("phase 5 provides readable, responsive, reduced-motion messaging UI", () => {
  assert.match(css, /font-size:\s*0\.75rem/);
  assert.match(css, /min-height:\s*3rem/);
  assert.match(css, /@media \(min-width: 1024px\)/);
  assert.match(css, /@media \(max-width: 639px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("phase 5 contract runs after the immutable realtime precheck prefix", () => {
  const parsed = JSON.parse(packageJson);
  assert.equal(parsed.scripts["test:messaging-v4"], "node --test scripts/messaging-v4.test.mjs");
  assert.match(parsed.scripts.precheck, /^npm run test:conversations-messaging-realtime/);
  assert.match(parsed.scripts.precheck, /test:messaging-v4/);
});
