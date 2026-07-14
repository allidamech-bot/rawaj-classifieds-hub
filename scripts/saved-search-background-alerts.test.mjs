import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [scannerSource, rootSource, packageSource, qualityGateSource] = await Promise.all([
  readFile(
    new URL(
      "../src/features/saved-searches/SavedSearchAlertBackgroundScanner.tsx",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
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

test("background saved-search alert contract is permanently gated", () => {
  const packageJson = JSON.parse(packageSource);
  assert.match(
    packageJson.scripts.check,
    /npm run test:saved-search-background-alerts/,
  );
  assert.match(
    packageJson.scripts["test:saved-search-background-alerts"],
    /saved-search-background-alerts\.test\.mjs/,
  );
  assert.match(qualityGateSource, /Saved search background alerts contract/);
  assert.match(qualityGateSource, /npm run test:saved-search-background-alerts/);
});
