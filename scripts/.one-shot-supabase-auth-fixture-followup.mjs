#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const target = path.join(process.cwd(), "cloudflare/worker/test/marketplace-fixtures.sql");
const source = await readFile(target, "utf8");
const expected = "SELECT RAISE(ABORT);";
const replacement = "SELECT RAISE(ABORT, 'audit_insert_failure_test');";

if (!source.includes(expected) && !source.includes(replacement)) {
  throw new Error("audit failure trigger statement was not found");
}

const next = source.replace(expected, replacement);
await writeFile(target, next, "utf8");
console.log("SQLite audit failure trigger syntax corrected.");
