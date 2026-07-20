import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [conversionSource, auditSql, runbook, workflow] = await Promise.all([
  readFile(new URL("../src/lib/syp-redenomination.ts", import.meta.url), "utf8"),
  readFile(
    new URL("./sql/syp-redenomination-production-audit.sql", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../docs/syp-redenomination-readiness.md", import.meta.url), "utf8"),
  readFile(
    new URL("../.github/workflows/syp-redenomination-readiness.yml", import.meta.url),
    "utf8",
  ),
]);

test("the official SYP redenomination factor is explicit and deterministic", () => {
  assert.match(conversionSource, /SYP_REDENOMINATION_FACTOR = 100/);
  assert.match(conversionSource, /export type SypDenomination = "old" \| "new"/);
  assert.match(conversionSource, /amount \/ SYP_REDENOMINATION_FACTOR/);
  assert.match(conversionSource, /amount \* SYP_REDENOMINATION_FACTOR/);
  assert.match(conversionSource, /Number\.isFinite\(amount\)/);
  assert.match(conversionSource, /amount < 0/);
  assert.match(conversionSource, /throw new RangeError/);
});

test("the conversion layer exposes both canonical and dual-denomination helpers", () => {
  assert.match(conversionSource, /export function convertSypAmount/);
  assert.match(conversionSource, /export function toNewSyp/);
  assert.match(conversionSource, /export function toOldSyp/);
  assert.match(conversionSource, /export function createDualSypAmount/);
  assert.match(conversionSource, /oldSyp: toOldSyp/);
  assert.match(conversionSource, /newSyp: toNewSyp/);
});

test("the Production audit is transactionally read-only", () => {
  assert.match(auditSql, /^begin transaction read only;/i);
  assert.match(auditSql, /rollback;\s*$/i);
  assert.match(auditSql, /information_schema\.columns/);
  assert.match(auditSql, /public\.listings/);
  assert.match(auditSql, /favorite_listing_snapshots/);
  assert.match(auditSql, /listing_price_changes/);
  assert.match(auditSql, /saved_searches/);
  assert.match(auditSql, /pg_get_functiondef/);
  assert.doesNotMatch(
    auditSql,
    /\b(?:insert|update|delete|merge|alter|create|drop|truncate|grant|revoke|comment)\b/i,
  );
});

test("classification is mandatory before any numeric conversion", () => {
  assert.match(runbook, /current `currency = 'SYP'` value identifies the currency but not/);
  assert.match(runbook, /Backfill all existing priced `SYP` rows as `unclassified`/);
  assert.match(runbook, /Do not alter the stored numeric `price` during this phase/);
  assert.match(runbook, /Phase B may begin only after every priced SYP row is classified/);
  assert.match(runbook, /no `unclassified` priced SYP rows/);
  assert.match(runbook, /Never infer denomination from price magnitude/);
  assert.match(runbook, /preserve original values in an audit table/);
  assert.match(runbook, /be reversible/);
});

test("the readiness contract is a permanent pull-request and main gate", () => {
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /branches:\s*\n\s*- main/g);
  assert.match(workflow, /node --test scripts\/syp-redenomination-readiness\.test\.mjs/);
  assert.match(workflow, /npm run typecheck -- --pretty false/);
});
