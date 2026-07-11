import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/202607110016_promotion_status_notifications.sql",
    import.meta.url,
  ),
  "utf8",
);

test("promotion moderation remains permission and stale-write protected", () => {
  assert.match(migration, /current_user_can_moderate\(\)/);
  assert.match(migration, /status = 'pending_review'/);
  assert.match(migration, /updated_at = p_expected_updated_at/);
  assert.match(migration, /stale_promotion_request/);
});

test("approved and rejected promotion decisions notify the requester", () => {
  assert.match(migration, /promotion\.approved/);
  assert.match(migration, /promotion\.rejected/);
  assert.match(migration, /rawaj_create_notification/);
  assert.match(migration, /v_requester_user_id/);
  assert.match(migration, /'listing_promotion_request'/);
});

test("notification metadata and moderation audit remain attached", () => {
  assert.match(migration, /'listing_id', v_listing_id/);
  assert.match(migration, /'promotion_type', v_promotion_type/);
  assert.match(migration, /'status', p_status/);
  assert.match(migration, /rawaj_insert_audit_log/);
});
