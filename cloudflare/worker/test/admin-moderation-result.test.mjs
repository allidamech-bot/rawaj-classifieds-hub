import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/admin.ts", import.meta.url), "utf8");

test("admin moderation verifies persisted D1 state instead of optional batch metadata", () => {
  assert.doesNotMatch(source, /const updateMeta = results\[0\]\.meta/);
  assert.doesNotMatch(source, /modActionMeta\.changes/);
  assert.doesNotMatch(source, /auditMeta\.changes/);
  assert.match(source, /const moderationActionId = crypto\.randomUUID\(\)/);
  assert.match(source, /const auditLogId = crypto\.randomUUID\(\)/);
  assert.match(source, /AS moderation_ok/);
  assert.match(source, /AS audit_ok/);
  assert.match(source, /persisted\.status !== nextStatus/);
  assert.match(source, /persisted\.updated_at !== timestamp/);
});
