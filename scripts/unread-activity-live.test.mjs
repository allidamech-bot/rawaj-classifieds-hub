import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [activitySource, packageSource] = await Promise.all([
  readFile(new URL("../src/lib/unread-activity.tsx", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("unread activity subscribes to the signed-in user's notification changes", () => {
  assert.match(activitySource, /getClient\(\)/);
  assert.match(activitySource, /channel\(`rawaj-unread-activity:\$\{profileId\}`\)/);
  assert.match(activitySource, /"postgres_changes"/);
  assert.match(activitySource, /event: "\*"/);
  assert.match(activitySource, /table: "notifications"/);
  assert.match(activitySource, /filter: `recipient_id=eq\.\$\{profileId\}`/);
  assert.match(activitySource, /removeChannel\(channel\)/);
});

test("notification bursts are debounced before unread counts refresh", () => {
  assert.match(activitySource, /UNREAD_ACTIVITY_EVENT_DEBOUNCE_MS = 250/);
  assert.match(activitySource, /if \(refreshTimer !== null\) clearTimeout\(refreshTimer\)/);
  assert.match(
    activitySource,
    /setTimeout\(\(\) => void refresh\(\), UNREAD_ACTIVITY_EVENT_DEBOUNCE_MS\)/,
  );
  assert.match(activitySource, /document\.visibilityState === "hidden"/);
});

test("unread activity has a visible online polling fallback", () => {
  assert.match(activitySource, /UNREAD_ACTIVITY_POLL_MS = 60 \* 1000/);
  assert.match(activitySource, /window\.setInterval\(refreshWhenAvailable, UNREAD_ACTIVITY_POLL_MS\)/);
  assert.match(activitySource, /navigator\.onLine === false/);
  assert.match(activitySource, /addEventListener\("online", refreshWhenAvailable\)/);
  assert.match(activitySource, /addEventListener\("visibilitychange", refreshWhenAvailable\)/);
});

test("unread refreshes are deduplicated and stale account results are ignored", () => {
  assert.match(activitySource, /refreshInFlightRef = useRef<Promise<void> \| null>\(null\)/);
  assert.match(activitySource, /const activeRefresh = refreshInFlightRef\.current/);
  assert.match(activitySource, /if \(activeRefresh\) return activeRefresh/);
  assert.match(activitySource, /activeProfileRef\.current !== profileId/);
  assert.match(activitySource, /refreshInFlightRef\.current = null/);
});

test("live unread activity contract is part of the activity Quality Gate", () => {
  const packageJson = JSON.parse(packageSource);
  assert.match(packageJson.scripts["test:activity-center"], /unread-activity-live\.test\.mjs/);
  assert.match(packageJson.scripts.check, /npm run test:activity-center/);
});
