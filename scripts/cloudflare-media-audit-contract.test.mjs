import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../cloudflare/migration/audit-supabase-media.mjs", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(
  await readFile(new URL("../cloudflare/migration/package.json", import.meta.url), "utf8"),
);

test("media audit derives migration allowlist only from database references", () => {
  for (const table of [
    "public.listing_images",
    "public.profiles",
    "public.conversation_messages",
    "public.seller_verification_requests",
    "public.listing_promotion_requests",
    "public.ad_placements",
  ]) {
    assert.match(source, new RegExp(table.replace(".", "\\.")));
  }
  assert.match(source, /migrationPolicy:\s*"database-reference-allowlist-only"/);
  assert.match(source, /orphaned/);
  assert.match(source, /duplicateGroups/);
  assert.match(source, /missing/);
});

test("media audit blocks implausible or incomplete migrations", () => {
  assert.match(source, /RAWAJ_MAX_REFERENCED_MEDIA_BYTES/);
  assert.match(source, /Referenced media is missing/);
  assert.match(source, /exceeds safety ceiling/);
});

test("snapshot export cannot run before media audit", () => {
  assert.equal(
    packageJson.scripts["export:public"],
    "npm run audit:media && node export-public-snapshot.mjs",
  );
});
