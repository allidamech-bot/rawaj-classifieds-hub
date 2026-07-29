import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [activitySource, packageSource] = await Promise.all([
  readFile(new URL("../src/lib/unread-activity.tsx", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("unread activity subscribes to signed-in notification and messaging changes", () => {
  assert.match(activitySource, /getClient\(\)/);
  assert.match(activitySource, /channel\(`rawaj-unread-activity:\$\{profileId\}`\)/);
  assert.match(activitySource, /"postgres_changes"/);
  assert.match(activitySource, /event: "\*"/);
  assert.match(activitySource, /table: "notifications"/);
  assert.match(activitySource, /filter: `recipient_id=eq\.\$\{profileId\}`/);
  assert.match(activitySource, /event: "INSERT"/);
  assert.match(activitySource, /table: "conversation_messages"/);
  assert.match(activitySource, /event: "UPDATE"/);
  assert.match(activitySource, /table: "conversations"/);
  assert.match(activitySource, /removeChannel\(channel\)/);
});

test("notification and message bursts are debounced before unread counts refresh", () => {
  assert.match(activitySource, /UNREAD_ACTIVITY_EVENT_DEBOUNCE_MS = 250/);
  assert.match(activitySource, /if \(refreshTimer !== null\) clearTimeout\(refreshTimer\)/);
  assert.match(
    activitySource,
    /setTimeout\(\(\) => void refresh\(\), UNREAD_ACTIVITY_EVENT_DEBOUNCE_MS\)/,
  );
  assert.match(activitySource, /document\.visibilityState === "hidden"/);
  assert.match(activitySource, /navigator\.onLine === false/);
});

test("unread activity uses controlled Cloudflare polling and legacy realtime lifecycle refreshes", () => {
  assert.doesNotMatch(activitySource, /UNREAD_ACTIVITY_POLL_MS/);
  assert.match(activitySource, /if \(isCloudflarePublicDataProvider\(\)\)/);
  assert.match(activitySource, /window\.setInterval\(refreshWhenVisible, 30_000\)/);
  assert.match(activitySource, /document\.visibilityState === "visible"/);
  assert.match(activitySource, /window\.clearInterval\(interval\)/);
  assert.match(activitySource, /removeEventListener\("visibilitychange", refreshWhenVisible\)/);
  assert.match(activitySource, /addEventListener\("focus", handleRefresh\)/);
  assert.match(activitySource, /addEventListener\("online", handleRefresh\)/);
  assert.match(activitySource, /UNREAD_ACTIVITY_CHANGED_EVENT/);
});

test("unread refreshes are deduplicated per profile and stale account results are ignored", () => {
  assert.match(activitySource, /interface InFlightUnreadRefresh/);
  assert.match(
    activitySource,
    /refreshInFlightRef = useRef<InFlightUnreadRefresh \| null>\(null\)/,
  );
  assert.match(activitySource, /activeProfileRef\.current = auth\.status === "signedIn"/);
  assert.match(activitySource, /const activeRefresh = refreshInFlightRef\.current/);
  assert.match(activitySource, /activeRefresh\?\.profileId === profileId/);
  assert.match(activitySource, /return activeRefresh\.promise/);
  assert.match(activitySource, /activeProfileRef\.current !== profileId/);
  assert.match(activitySource, /const refreshRecord: InFlightUnreadRefresh/);
  assert.match(activitySource, /refreshRecord\.promise = request/);
  assert.match(activitySource, /refreshInFlightRef\.current = refreshRecord/);
  assert.match(activitySource, /refreshInFlightRef\.current = null/);
});

test("live unread activity contract is part of the activity Quality Gate", () => {
  const packageJson = JSON.parse(packageSource);
  assert.match(packageJson.scripts["test:activity-center"], /unread-activity-live\.test\.mjs/);
  assert.match(packageJson.scripts.check, /npm run test:activity-center/);
});
