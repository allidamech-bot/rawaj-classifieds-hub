import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [scannerSource, routeSource, rootSource, packageSource] = await Promise.all([
  readFile(
    new URL(
      "../src/features/saved-searches/SavedSearchAlertBackgroundScanner.tsx",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(new URL("../src/routes/saved-searches.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("saved-search alerts scan automatically for signed-in users", () => {
  assert.match(scannerSource, /auth\.status !== "signedIn"/);
  assert.match(scannerSource, /scanDueSavedSearchAlerts\(userId\)/);
  assert.match(scannerSource, /SavedSearchAlertBackgroundScanner/);
  assert.match(rootSource, /<SavedSearchAlertBackgroundScanner \/>/);
  assert.ok(
    rootSource.indexOf("<UnreadActivityProvider>") <
      rootSource.indexOf("<SavedSearchAlertBackgroundScanner />"),
  );
});

test("background scans are delayed, online-aware, and throttled", () => {
  assert.match(scannerSource, /SCAN_THROTTLE_MS = 6 \* 60 \* 60 \* 1000/);
  assert.match(scannerSource, /SCAN_START_DELAY_MS = 1_500/);
  assert.match(scannerSource, /requestIdleCallback/);
  assert.match(scannerSource, /setTimeout\(run, SCAN_START_DELAY_MS\)/);
  assert.match(scannerSource, /navigator\.onLine === false/);
  assert.match(scannerSource, /addEventListener\("online", handleOnline\)/);
  assert.match(scannerSource, /rawaj:saved-search-background-scan:v1/);
  assert.match(scannerSource, /window\.localStorage\.setItem/);
});

test("background scans deduplicate work and update unread activity only after success", () => {
  assert.match(scannerSource, /const inFlightScans = new Map<string, Promise<void>>\(\)/);
  assert.match(scannerSource, /const activeScan = inFlightScans\.get\(userId\)/);
  assert.match(scannerSource, /if \(!result\.ok\) return/);
  assert.ok(
    scannerSource.indexOf("if (!result.ok) return") <
      scannerSource.indexOf("rememberSuccessfulScan(userId, Date.now())"),
  );
  assert.match(scannerSource, /result\.data\.createdNotifications > 0/);
  assert.match(scannerSource, /emitUnreadActivityChanged\(\)/);
  assert.match(scannerSource, /inFlightScans\.delete\(userId\)/);
});

test("saved-search route preserves loaded searches when scanning or refresh fails", () => {
  assert.match(routeSource, /const \[hasLoaded, setHasLoaded\]/);
  assert.match(routeSource, /const \[loadError, setLoadError\]/);
  assert.match(routeSource, /const loadSavedSearches = useCallback/);
  assert.match(routeSource, /loadError && !hasLoaded/);
  assert.match(routeSource, /onAction=\{\(\) => void loadSavedSearches\(\)\}/);
  assert.match(routeSource, /actionLabel=\{text\("إعادة المحاولة", "Try again"\)\}/);
  assert.match(
    routeSource,
    /Saved searches loaded, but new matches could not be scanned right now/,
  );
  assert.match(
    routeSource,
    /if \(!result\.ok\) \{[\s\S]*setLoadError\(result\.error\);[\s\S]*setLoading\(false\);[\s\S]*return;/,
  );
  assert.match(
    routeSource,
    /if \(refreshed\.ok\) \{[\s\S]*setItems\(refreshed\.data\);[\s\S]*\} else \{[\s\S]*setScanMessage/,
  );
});

test("saved-search route rejects stale account and route responses", () => {
  assert.match(routeSource, /const loadRequestIdRef = useRef\(0\)/);
  assert.match(routeSource, /requestId !== loadRequestIdRef\.current/);
  assert.match(routeSource, /currentProfileId !== auth\.profile\?\.id/);
  assert.match(routeSource, /return \(\) => \{[\s\S]*loadRequestIdRef\.current \+= 1;[\s\S]*\};/);
});

test("saved-search mutation failures use action messaging", () => {
  const frequencyStart = routeSource.indexOf("async function changeAlertFrequency");
  const removeStart = routeSource.indexOf("async function removeSavedSearch");
  const signedOutStart = routeSource.indexOf('if (auth.status === "loading")');
  assert.ok(frequencyStart >= 0);
  assert.ok(removeStart > frequencyStart);
  assert.ok(signedOutStart > removeStart);

  const frequencySection = routeSource.slice(frequencyStart, removeStart);
  const removeSection = routeSource.slice(removeStart, signedOutStart);
  assert.match(frequencySection, /setMessage\(result\.error\.message\)/);
  assert.doesNotMatch(frequencySection, /setLoadError/);
  assert.match(removeSection, /setMessage\(result\.error\.message\)/);
  assert.doesNotMatch(removeSection, /setLoadError/);
});

test("background saved-search alert contract is part of the activity Quality Gate", () => {
  const packageJson = JSON.parse(packageSource);
  assert.match(
    packageJson.scripts["test:activity-center"],
    /saved-search-background-alerts\.test\.mjs/,
  );
  assert.match(packageJson.scripts.check, /npm run test:activity-center/);
});
