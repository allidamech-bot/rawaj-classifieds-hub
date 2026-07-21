import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [ledger, storageAudit, logSummary, authRunbook, productionWorkflow, packageSource] =
  await Promise.all([
    readFile(new URL("../docs/syria-launch-closure.md", import.meta.url), "utf8"),
    readFile(
      new URL("./sql/listing-images-storage-integrity-audit.sql", import.meta.url),
      "utf8",
    ),
    readFile(new URL("./summarize-supabase-storage-logs.mjs", import.meta.url), "utf8"),
    readFile(new URL("../docs/production-auth-app-links.md", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/production-acceptance.yml", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

test("the Syria closure ledger contains exactly eight numbered gates and excludes Saudi scope", () => {
  const gateRows = ledger.match(/^\| [1-8] \|/gm) ?? [];
  assert.equal(gateRows.length, 8);
  assert.match(ledger, /Saudi Arabia expansion is explicitly outside this scope/);
  assert.match(ledger, /Gate 8 is closed without deletion/);
  assert.match(ledger, /paid Staging approval required/);
  assert.match(ledger, /DEFERRED BY SAFETY/);
});

test("the Storage audit is structurally read-only and cannot be mistaken for cleanup authority", () => {
  assert.match(storageAudit, /begin transaction read only;/i);
  assert.match(storageAudit, /rollback;/i);
  assert.match(storageAudit, /bucket_id = 'listing-images'/);
  assert.match(storageAudit, /storage_without_row_count/);
  assert.match(storageAudit, /rows_without_storage_count/);
  assert.match(storageAudit, /duplicate_storage_path_groups/);
  assert.doesNotMatch(storageAudit, /\b(delete|update|insert|merge|truncate|alter|drop|create)\b/i);

  assert.match(ledger, /Never delete Storage objects from an audit result alone/);
  assert.match(ledger, /Storage objects without a `listing_images` row \| 0/);
  assert.match(ledger, /`listing_images` rows without a Storage object \| 0/);
});

test("Egress evidence separates automation and likely-user traffic", () => {
  assert.match(logSummary, /AUTOMATION_USER_AGENT/);
  assert.match(logSummary, /BROWSER_USER_AGENT/);
  assert.match(logSummary, /sign_requests/);
  assert.match(logSummary, /signed_downloads/);
  assert.match(logSummary, /repeated_sign_paths/);
  assert.match(logSummary, /automation_is_not_production_user_traffic: true/);
  assert.match(ledger, /Preview or CI logs/);
  assert.match(ledger, /post-deployment window/);
});

test("external Auth, App Links, and Production Acceptance gates remain explicit", () => {
  assert.match(authRunbook, /Site URL.*https:\/\/rawa-j\.com/s);
  assert.match(authRunbook, /RAWAJ_ANDROID_SHA256_CERT_FINGERPRINTS/);
  assert.match(authRunbook, /Play App Signing/);
  assert.match(authRunbook, /physical Android device/);

  assert.match(productionWorkflow, /workflow_dispatch:/);
  assert.match(productionWorkflow, /RAWAJ_ACCEPTANCE_EMAIL/);
  assert.match(productionWorkflow, /RAWAJ_ACCEPTANCE_PASSWORD/);
  assert.match(productionWorkflow, /https:\/\/rawa-j\.com/);
  assert.match(packageSource, /test:production-acceptance-contract/);

  assert.match(ledger, /Supabase Site URL and redirect allowlist evidence/);
  assert.match(ledger, /Play App Signing SHA-256/);
  assert.match(ledger, /dedicated acceptance account secrets/);
});

test("Phase B cannot start before Phase A staging proof and observation", () => {
  assert.match(ledger, /Must remain unstarted while Phase A is unproven on Staging/);
  assert.match(ledger, /Stable Phase A Production observation/);
  assert.match(ledger, /separate design\/branch\/migration\/rehearsal/);
});
