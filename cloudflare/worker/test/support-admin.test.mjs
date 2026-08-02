import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/trust-support.ts", import.meta.url), "utf8");

test("support requests expose a protected admin moderation contract", () => {
  assert.match(source, /\/v1\/admin\/support-requests/);
  assert.match(source, /support_request\.moderated/);
  assert.match(source, /public_response = \?/);
  assert.match(source, /assigned_to = \?/);
  assert.match(source, /stringValue\(persisted\.updated_at\) !== timestamp/);
  const moderateStart = source.indexOf("async function moderateSupportRequest(");
  const moderateEnd = source.indexOf("async function createListingReport(", moderateStart);
  assert.ok(moderateStart >= 0 && moderateEnd > moderateStart);
  assert.doesNotMatch(source.slice(moderateStart, moderateEnd), /changedRows\(result\)/);
});

test("internal support fields are only returned to administrators", () => {
  const publicStart = source.indexOf("function mapSupport(");
  const adminStart = source.indexOf("function mapAdminSupport(", publicStart);
  const adminEnd = source.indexOf("function mapListingReport(", adminStart);
  assert.ok(publicStart >= 0 && adminStart > publicStart && adminEnd > adminStart);
  const publicMapper = source.slice(publicStart, adminStart);
  const adminMapper = source.slice(adminStart, adminEnd);
  assert.doesNotMatch(publicMapper, /adminNote|assignedTo|row\.email|row\.priority/);
  assert.match(adminMapper, /adminNote/);
  assert.match(adminMapper, /assignedTo/);
  assert.match(adminMapper, /row\.email/);
  assert.match(source, /map\(mapAdminSupport\)/);
  assert.match(source, /mapAdminSupport\(persisted\)/);
});
