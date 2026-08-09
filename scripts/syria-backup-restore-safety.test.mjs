import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const auditScript = await readFile("cloudflare/worker/scripts/audit-production-d1.mjs", "utf8");
const procedure = await readFile("docs/backup-restore-protection.md", "utf8");

test("Syria backup is pinned to immutable country-specific resource identity", () => {
  for (const expected of [
    "rawaj-classifieds-hub",
    "rawaj-staging",
    "d0e6496c-9f63-48d3-beeb-d2e219500f6a",
    "rawaj-listing-images-production",
    "project-af18fcaf-c46e-4ec5-93a",
  ]) {
    assert.match(auditScript, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(procedure, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(auditScript, /options\.database !== SYRIA_PRODUCTION_IDENTITY\.database/);
  assert.match(auditScript, /\["D1 ID", d1\?\.database_id, SYRIA_PRODUCTION_IDENTITY\.databaseId\]/);
  assert.match(auditScript, /identity mismatch; refusing Syria production backup/);
  assert.match(auditScript, /databaseId: SYRIA_PRODUCTION_IDENTITY\.databaseId/);
});

test("Syria backup remains read-only and restore requires explicit verified destination", () => {
  assert.doesNotMatch(auditScript, /\bd1\s+migrations\s+apply\b|\bDROP\s+TABLE\b|\bDELETE\s+FROM\b/i);
  assert.match(procedure, /explicit destination/i);
  assert.match(procedure, /immutable D1 ID/i);
  assert.match(procedure, /Production restore is prohibited/i);
  assert.match(procedure, /local D1/i);
  assert.match(procedure, /Saudi|Gateway/);
});
