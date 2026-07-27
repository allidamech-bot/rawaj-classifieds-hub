#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const target = path.join(process.cwd(), "cloudflare/worker/test/marketplace.integration.test.mjs");
let source = await readFile(target, "utf8");

const moderatorRead = "const checkListing = await api(`/api/listings/${listingId}`, moderator);";
const moderatorReadCount = source.split(moderatorRead).length - 1;
if (moderatorReadCount !== 2) {
  throw new Error(`expected exactly two moderator rollback reads, found ${moderatorReadCount}`);
}
source = source.replaceAll(
  moderatorRead,
  "const checkListing = await api(`/api/listings/${listingId}`, owner);",
);

const statusRead = "checkListing.payload.data.status";
const updatedAtRead = "checkListing.payload.data.updatedAt";
const statusReadCount = source.split(statusRead).length - 1;
const updatedAtReadCount = source.split(updatedAtRead).length - 1;
if (statusReadCount !== 2 || updatedAtReadCount !== 2) {
  throw new Error(
    `expected two flat rollback reads for each field, found status=${statusReadCount}, updatedAt=${updatedAtReadCount}`,
  );
}
source = source
  .replaceAll(statusRead, "checkListing.payload.data.listing.status")
  .replaceAll(updatedAtRead, "checkListing.payload.data.listing.updatedAt");

await writeFile(target, source, "utf8");
console.log("Rollback assertions now use the owner session and listing-detail response shape.");
