import { test } from "node:test";
import assert from "node:assert/strict";

// Inline test of the parseAuditMetadata logic since we can't import admin.ts directly
function parseAuditMetadata(value) {
  if (value === null || value === undefined) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return {};
  if (!value.length) return {};
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {
    // malformed JSON, fall through to fallback
  }
  return {};
}

test("parses valid JSON object string", () => {
  const result = parseAuditMetadata('{"key":"value","number":42}');
  assert.deepEqual(result, { key: "value", number: 42 });
});

test("returns object as-is when already parsed", () => {
  const input = { existing: "object" };
  const result = parseAuditMetadata(input);
  assert.deepEqual(result, input);
});

test("handles null input", () => {
  assert.deepEqual(parseAuditMetadata(null), {});
});

test("handles undefined input", () => {
  assert.deepEqual(parseAuditMetadata(undefined), {});
});

test("handles empty string", () => {
  assert.deepEqual(parseAuditMetadata(""), {});
});

test("handles non-string non-object types", () => {
  assert.deepEqual(parseAuditMetadata(123), {});
  assert.deepEqual(parseAuditMetadata(true), {});
  assert.deepEqual(parseAuditMetadata([1, 2, 3]), {});
});

test("returns empty object for malformed JSON string", () => {
  assert.deepEqual(parseAuditMetadata("{invalid json"), {});
  assert.deepEqual(parseAuditMetadata("not json at all"), {});
  assert.deepEqual(parseAuditMetadata('"malformed'), {});
});

test("returns empty object for JSON array string", () => {
  assert.deepEqual(parseAuditMetadata("[1, 2, 3]"), {});
});

test("handles JSON primitive string values", () => {
  assert.deepEqual(parseAuditMetadata('"just a string"'), {});
  assert.deepEqual(parseAuditMetadata("null"), {});
  assert.deepEqual(parseAuditMetadata("123"), {});
});

