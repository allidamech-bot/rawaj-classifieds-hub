import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeStorageLogRecord,
  parseStorageLogExport,
  summarizeStorageLogs,
} from "./summarize-supabase-storage-logs.mjs";

test("parses JSON arrays, wrapped exports, and NDJSON", () => {
  assert.equal(parseStorageLogExport('[{"id":1},{"id":2}]').length, 2);
  assert.equal(parseStorageLogExport('{"logs":[{"id":1}]}').length, 1);
  assert.equal(parseStorageLogExport('{"id":1}\n{"id":2}').length, 2);
  assert.deepEqual(parseStorageLogExport("  "), []);
});

test("rejects an invalid NDJSON line with its line number", () => {
  assert.throws(
    () => parseStorageLogExport('{"id":1}\nnot-json'),
    /Invalid JSON log line 2/,
  );
});

test("normalizes nested fields and message-only fallback records", () => {
  const nested = normalizeStorageLogRecord({
    metadata: {
      request: {
        method: "POST",
        path: "/storage/v1/object/sign/listing-images",
        user_agent: "Mozilla/5.0 Chrome/149.0",
      },
      response: { status_code: 200, response_bytes: 321 },
    },
  });
  assert.deepEqual(
    {
      method: nested.method,
      pathname: nested.pathname,
      status: nested.status,
      responseBytes: nested.responseBytes,
      actor: nested.actor,
    },
    {
      method: "POST",
      pathname: "/storage/v1/object/sign/listing-images",
      status: 200,
      responseBytes: 321,
      actor: "likely_user",
    },
  );

  const fallback = normalizeStorageLogRecord({
    event_message: "POST | 200 | /storage/v1/object/sign/listing-images",
    user_agent: "node",
  });
  assert.equal(fallback.method, "POST");
  assert.equal(fallback.pathname, "/storage/v1/object/sign/listing-images");
  assert.equal(fallback.status, 200);
  assert.equal(fallback.actor, "automation");
});

test("summarizes signing, downloads, actor classes, repetition, and observed bytes", () => {
  const records = [
    {
      method: "POST",
      path: "/storage/v1/object/sign/listing-images/item-a.webp",
      user_agent: "node",
      status_code: 200,
    },
    {
      method: "POST",
      path: "/storage/v1/object/sign/listing-images/item-a.webp?token=secret",
      user_agent: "Mozilla/5.0 Chrome/149.0",
      status_code: 200,
    },
    {
      method: "GET",
      path: "/storage/v1/object/sign/listing-images/item-a.webp",
      user_agent: "Mozilla/5.0 Chrome/149.0",
      status_code: 200,
      response_bytes: 2048,
    },
    {
      method: "GET",
      path: "/storage/v1/object/public/profile-media/avatar.webp",
      user_agent: "custom-client",
      status_code: 304,
      response_bytes: 0,
    },
    {
      method: "GET",
      path: "/rest/v1/listings",
      user_agent: "Mozilla/5.0 Chrome/149.0",
      status_code: 200,
    },
  ];

  const summary = summarizeStorageLogs(records);
  assert.equal(summary.input_records, 5);
  assert.equal(summary.storage_requests, 4);
  assert.equal(summary.listing_images_requests, 3);
  assert.equal(summary.sign_requests, 2);
  assert.equal(summary.signed_downloads, 1);
  assert.equal(summary.observed_response_bytes, 2048);
  assert.deepEqual(summary.actors, { likely_user: 2, automation: 1, unknown: 1 });
  assert.deepEqual(summary.statuses, { "200": 3, "304": 1 });
  assert.deepEqual(summary.repeated_sign_paths, {
    "/storage/v1/object/sign/listing-images/item-a.webp": 2,
  });
  assert.equal(summary.interpretation.automation_is_not_production_user_traffic, true);
});
