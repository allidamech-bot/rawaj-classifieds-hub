import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const client = await readFile(
  new URL("../src/lib/api/listing-data-quality.ts", import.meta.url),
  "utf8",
);

test("client exposes a cross-category issue model", () => {
  for (const typeName of [
    "ListingDataQualityStatus",
    "ListingDataQualityIssueType",
    "ListingDataQualitySeverity",
    "ListingDataQualityDecision",
    "ListingDataQualityIssue",
    "ListingDataQualityPage",
    "ListingDataQualityRefreshResult",
  ]) {
    assert.ok(client.includes(typeName));
  }

  for (const issueType of [
    "taxonomy",
    "required_field",
    "unexpected_field",
    "invalid_value",
    "legacy_payload",
    "specialized_reference",
  ]) {
    assert.ok(client.includes(`"${issueType}"`));
  }
});

test("client filters by category, issue type, severity, and review state", () => {
  for (const parameter of [
    "p_status",
    "p_issue_type",
    "p_category_id",
    "p_severity",
    "p_limit",
    "p_offset",
  ]) {
    assert.ok(client.includes(parameter));
  }
  assert.match(client, /clampInteger\(options\.limit, 1, 200, 50\)/);
});

test("client uses only governed quality RPCs", () => {
  for (const rpc of [
    "rawaj_admin_fetch_listing_data_quality_v1",
    "rawaj_owner_refresh_listing_data_quality_v1",
    "rawaj_admin_review_listing_data_quality_v1",
  ]) {
    assert.ok(client.includes(`"${rpc}"`));
  }
  assert.ok(client.includes("clientResult.data.rpc"));
  assert.doesNotMatch(client, /\.from\("listing_data_quality_issues"/);
  assert.doesNotMatch(client, /\.from\("listings"/);
  assert.doesNotMatch(client, /\.from\("listing_attribute_values"/);
});

test("review mutations carry stale-write protection", () => {
  assert.ok(client.includes("p_expected_updated_at"));
  assert.ok(client.includes("stale_data_quality_review"));
  assert.ok(client.includes("تغيّرت نتيجة الفحص"));
});

test("untrusted payloads are parsed and invalid rows are discarded", () => {
  for (const parser of [
    "function parsePage",
    "function parseIssue",
    "function parseIssueType",
    "function parseSeverity",
    "function parseStatus",
    ".filter(isPresent)",
  ]) {
    assert.ok(client.includes(parser));
  }
});
