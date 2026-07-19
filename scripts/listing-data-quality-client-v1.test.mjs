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
    assert.match(client, new RegExp(`export (?:type|interface) ${typeName}`));
  }

  for (const issueType of [
    "taxonomy",
    "required_field",
    "unexpected_field",
    "invalid_value",
    "legacy_payload",
    "specialized_reference",
  ]) {
    assert.match(client, new RegExp(`"${issueType}"`));
  }
});

test("client filters by category, issue type, severity, and review state", () => {
  assert.match(client, /p_status: options\.status \?\? null/);
  assert.match(client, /p_issue_type: options\.issueType \?\? null/);
  assert.match(client, /p_category_id: cleanNullableText\(options\.categoryId\)/);
  assert.match(client, /p_severity: options\.severity \?\? null/);
  assert.match(client, /clampInteger\(options\.limit, 1, 200, 50\)/);
});

test("client uses only governed quality RPCs", () => {
  for (const rpc of [
    "rawaj_admin_fetch_listing_data_quality_v1",
    "rawaj_owner_refresh_listing_data_quality_v1",
    "rawaj_admin_review_listing_data_quality_v1",
  ]) {
    assert.match(client, new RegExp(`\.rpc\(\s*"${rpc}"`));
  }
  assert.doesNotMatch(client, /\.from\("listing_data_quality_issues"/);
  assert.doesNotMatch(client, /\.from\("listings"/);
  assert.doesNotMatch(client, /\.from\("listing_attribute_values"/);
});

test("review mutations carry stale-write protection", () => {
  assert.match(client, /p_expected_updated_at: input\.expectedUpdatedAt\.trim\(\)/);
  assert.match(client, /stale_data_quality_review/);
  assert.match(client, /تغيّرت نتيجة الفحص/);
});

test("untrusted payloads are parsed and invalid rows are discarded", () => {
  assert.match(client, /function parsePage/);
  assert.match(client, /function parseIssue/);
  assert.match(client, /items: array\(payload\.items\)\.map\(parseIssue\)\.filter\(isPresent\)/);
  assert.match(client, /function parseIssueType/);
  assert.match(client, /function parseSeverity/);
  assert.match(client, /function parseStatus/);
});
