#!/usr/bin/env node

import { DatabaseSync } from "node:sqlite";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const migrationsDirectory = path.join(root, "cloudflare", "d1", "migrations");
const requiredObjects = new Set([
  "auth_users",
  "public_profiles",
  "user_roles",
  "categories",
  "taxonomy_nodes",
  "location_nodes",
  "listings",
  "listing_images",
  "media_assets",
  "favorites",
  "saved_searches",
  "conversations",
  "conversation_messages",
  "notifications",
  "seller_reviews",
  "seller_verification_requests",
  "audit_logs",
]);

const migrations = (await readdir(migrationsDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (migrations.length === 0) throw new Error("No D1 migrations found.");

const database = new DatabaseSync(":memory:");
database.exec("PRAGMA foreign_keys = ON");

for (const migration of migrations) {
  try {
    database.exec(await readFile(path.join(migrationsDirectory, migration), "utf8"));
  } catch (error) {
    throw new Error(`D1 migration failed: ${migration}: ${error instanceof Error ? error.message : error}`);
  }
}

const objects = new Set(
  database
    .prepare("SELECT name FROM sqlite_schema WHERE type IN ('table', 'view')")
    .all()
    .map((row) => String(row.name)),
);
const missing = [...requiredObjects].filter((name) => !objects.has(name));
if (missing.length > 0) throw new Error(`Missing required D1 objects: ${missing.join(", ")}`);

const violations = database.prepare("PRAGMA foreign_key_check").all();
if (violations.length > 0) {
  throw new Error(`D1 foreign-key violations: ${JSON.stringify(violations.slice(0, 20))}`);
}

const tableCount = Number(
  database
    .prepare("SELECT count(*) AS count FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .get().count,
);

console.log(
  `D1 replay passed: ${migrations.length} migrations, ${tableCount} tables, 0 foreign-key violations.`,
);
