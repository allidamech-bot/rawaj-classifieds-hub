#!/usr/bin/env node

import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const migrationsDirectory = path.join(root, "cloudflare", "d1", "migrations");

const database = new DatabaseSync(":memory:");
database.exec("PRAGMA foreign_keys = ON");

const migration0017Path = path.join(
  migrationsDirectory,
  "0017_listing_moderation_actions_contract.sql",
);

database.exec(`
  CREATE TABLE listings (id TEXT PRIMARY KEY);
  CREATE TABLE auth_users (id TEXT PRIMARY KEY);
  CREATE TABLE listing_moderation_actions (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    action TEXT,
    reason TEXT,
    metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
    created_at TEXT NOT NULL,
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES auth_users(id) ON DELETE RESTRICT
  );
`);

database.exec(`
  INSERT INTO listings (id) VALUES ('test-listing');
  INSERT INTO auth_users (id) VALUES ('test-actor');
  INSERT INTO listing_moderation_actions (id, listing_id, actor_id, action, reason, metadata, created_at)
  VALUES ('restore-test-id', 'test-listing', 'test-actor', 'restore', 'test reason', '{}', '2026-01-01T00:00:00.000Z');
`);

const countBefore = Number(
  database.prepare("SELECT count(*) AS c FROM listing_moderation_actions").get().c,
);
console.log(`Before migration 0017: ${countBefore} row(s) in listing_moderation_actions`);
console.log(
  `restore record exists: ${database.prepare("SELECT count(*) AS c FROM listing_moderation_actions WHERE action = 'restore'").get().c === 1 ? "yes" : "no"}`,
);

database.exec(await readFile(migration0017Path, "utf8"));

const countAfter = Number(
  database.prepare("SELECT count(*) AS c FROM listing_moderation_actions").get().c,
);
console.log(`After migration 0017: ${countAfter} row(s) in listing_moderation_actions`);
console.log(
  `restore record preserved: ${database.prepare("SELECT count(*) AS c FROM listing_moderation_actions WHERE action = 'restore'").get().c === 1 ? "yes" : "no"}`,
);

const indexExists =
  database
    .prepare(
      "SELECT count(*) AS c FROM sqlite_schema WHERE name = 'idx_listing_moderation_actions_listing'",
    )
    .get().c === 1;
console.log(`Index preserved: ${indexExists ? "yes" : "no"}`);

if (countAfter !== countBefore) {
  throw new Error(`Row count mismatch: expected ${countBefore}, got ${countAfter}`);
}

if (
  database
    .prepare("SELECT count(*) AS c FROM listing_moderation_actions WHERE action = 'restore'")
    .get().c !== 1
) {
  throw new Error("restore record was not preserved by migration 0017");
}

console.log("Migration 0017 preservation test passed.");
