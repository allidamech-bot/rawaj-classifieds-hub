import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/202607170006_server_account_bootstrap_integrity.sql",
    import.meta.url,
  ),
  "utf8",
);

const ledger = await readFile(
  new URL("../docs/production-schema/migration-ledger.json", import.meta.url),
  "utf8",
);

test("new auth identities receive a server-side profile and default user role", () => {
  assert.match(migration, /create trigger rawaj_auth_user_bootstrap/);
  assert.match(migration, /after insert on auth\.users/);
  assert.match(migration, /insert into public\.profiles/);
  assert.match(migration, /insert into public\.user_roles \(user_id, role\)/);
  assert.match(migration, /values \(new\.id, 'user'\)/);
});

test("bootstrap preserves existing privileged account state", () => {
  assert.match(migration, /on conflict \(id\) do update/);
  assert.match(
    migration,
    /display_name = coalesce\(public\.profiles\.display_name, excluded\.display_name\)/,
  );
  assert.doesNotMatch(migration, /account_status = excluded\.account_status/);
  assert.doesNotMatch(migration, /verification_status = excluded\.verification_status/);
  assert.doesNotMatch(migration, /delete from public\.user_roles/);
});

test("existing auth users are backfilled idempotently", () => {
  assert.match(migration, /from auth\.users as users/);
  assert.match(migration, /where profiles\.id is null/);
  assert.match(migration, /on conflict \(id\) do nothing/);
  assert.match(migration, /on conflict \(user_id, role\) do nothing/);
});

test("metadata-derived names are bounded and server-owned", () => {
  assert.match(migration, /new\.raw_user_meta_data ->> 'display_name'/);
  assert.match(migration, /left\([\s\S]*120/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = public/);
});

test("migration ledger records phase 19", () => {
  assert.match(ledger, /202607170006_server_account_bootstrap_integrity\.sql/);
});
