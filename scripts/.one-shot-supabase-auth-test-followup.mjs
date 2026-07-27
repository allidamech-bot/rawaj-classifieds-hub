#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const target = path.join(process.cwd(), "cloudflare/worker/test/marketplace.integration.test.mjs");
const source = await readFile(target, "utf8");
const expected = "const checkListing = await api(`/api/listings/${listingId}`, moderator);";
const matches = source.split(expected).length - 1;
if (matches !== 2) {
  throw new Error(`expected exactly two moderator rollback reads, found ${matches}`);
}
const next = source.replaceAll(
  expected,
  "const checkListing = await api(`/api/listings/${listingId}`, owner);",
);
await writeFile(target, next, "utf8");
console.log("Rollback assertions now read private listings through the owner session.");
