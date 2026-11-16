import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const combined = read("src/personal-activity-system-v10.css");
const command = read("src/activity-command-premium.css");
const messaging = read("src/messaging-v4.css");
const mobile = read("src/communication-center-v3.css");

test("B3.2 restores source-owned identity without changing B3.1 saved collection surfaces", () => {
  const start = combined.indexOf("/* B3.2");
  const end = combined.indexOf("/* B3.1 favorites:", start);
  assert.ok(start > 0 && end > start, "B3.2 must remain isolated from B3.1");
  const communication = combined.slice(start, end);
  for (const route of ["/activity", "/notifications", "/chats"]) {
    assert.ok(communication.includes(`data-resolved-pathname="${route}"`));
  }
  for (const color of ["#083d38", "#fffaf3", "#173d38", "#075d52"]) {
    assert.ok(communication.includes(color), `missing identity color ${color}`);
  }
  assert.doesNotMatch(communication, /#(?:303137|292a30|1a1d25|87415b|6b406d|e9663c)/i);
  const collections = combined.slice(end);
  assert.match(collections, /rawaj-route-favorites/);
  assert.match(collections, /rawaj-route-saved-searches/);
  assert.match(collections, /B3\.1 saved searches/);
});

test("B3.2 activity source owner replaces the old charcoal theme while keeping state and focus", () => {
  assert.match(command, /data-resolved-pathname="\/activity"/);
  assert.match(command, /\.rawaj-activity-tabs button\[aria-selected="true"\]/);
  assert.match(command, /\.rawaj-notification-timeline\[data-read="false"\]/);
  assert.match(command, /\.rawaj-activity-conversation/);
  assert.match(command, /:focus-visible/);
  assert.match(command, /prefers-reduced-motion/);
  assert.doesNotMatch(command, /#(?:101319|0d1016|0b0e13|181c23|1a1d25|d948ad)/i);
});

test("B3.2 messenger keeps list-first mobile state, safety and distinct sender bubbles", () => {
  assert.match(mobile, /data-view="list"/);
  assert.match(mobile, /data-view="conversation"/);
  assert.match(mobile, /\.rawaj-message-panel\.hidden/);
  assert.match(messaging, /rawaj-message-bubble\[data-mine="true"\]/);
  assert.doesNotMatch(messaging, /rawaj-message-composer__block-reason/);
  assert.match(messaging, /rawaj-message-offers-toggle/);
  assert.match(messaging, /rawaj-message-bubble__report/);
  assert.match(messaging, /rawaj-message-composer__send/);
  assert.match(messaging, /prefers-reduced-motion/);
  assert.doesNotMatch(messaging, /--rawaj-accent-orange/);
});

test("B3.2 removes legacy V18 dark route overrides instead of masking them", () => {
  const legacy = read("src/rawaj-chromatic-premium-system-v18-legacy-surfaces.css");
  assert.doesNotMatch(legacy, /data-resolved-pathname="\/notifications"/);
  assert.doesNotMatch(legacy, /data-resolved-pathname="\/activity"/);
  assert.match(legacy, /data-resolved-pathname="\/favorites"/);
  assert.match(legacy, /data-resolved-pathname="\/saved-searches"/);
});
