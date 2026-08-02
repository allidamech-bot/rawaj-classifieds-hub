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
  const start = source.indexOf("async function moderateSupportRequest(");
  const end = source.indexOf("async function createListingReport(", start);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(source.slice(start, end), /changedRows\(result\)/);
});
