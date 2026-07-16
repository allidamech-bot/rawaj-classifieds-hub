import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/202607160002_require_listing_moderation_audit.sql",
    import.meta.url,
  ),
  "utf8",
);

const moderationInsertIndex = migration.indexOf(
  "insert into public.listing_moderation_actions",
);
const auditInsertIndex = migration.indexOf("perform public.rawaj_insert_audit_log");
const notificationIndex = migration.indexOf("perform public.rawaj_create_notification");
const exceptionBlockIndex = migration.indexOf("\n  exception\n");

test("listing review decision keeps moderation history and audit atomic with the state transition", () => {
  assert.match(migration, /create or replace function public\.rawaj_review_listing_decision/);
  assert.ok(moderationInsertIndex > -1, "moderation action insert must exist");
  assert.ok(auditInsertIndex > moderationInsertIndex, "audit write must follow moderation history");
  assert.ok(notificationIndex > auditInsertIndex, "notification must run only after required audit writes");
  assert.ok(
    exceptionBlockIndex > auditInsertIndex,
    "required moderation and audit writes must not be protected by exception swallowing",
  );
});

test("only owner notification delivery remains best effort", () => {
  const exceptionMatches = migration.match(/exception\s+when others then\s+null;/g) ?? [];
  assert.equal(exceptionMatches.length, 1);
  assert.ok(exceptionBlockIndex > notificationIndex);
  assert.match(migration, /Best-effort only: notification delivery/);
});

test("review decision preserves stale-write and permission boundaries", () => {
  assert.match(migration, /rawaj_current_user_can_review_listings\(\)/);
  assert.match(migration, /p_expected_updated_at is null/);
  assert.match(migration, /raise exception 'stale_review'/);
  assert.match(
    migration,
    /grant execute on function public\.rawaj_review_listing_decision\(uuid, text, text, timestamptz\) to authenticated/,
  );
});
