import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const seedPath = new URL("../supabase/demo-data/seed_launch_demo_listings.sql", import.meta.url);
const cleanupPath = new URL(
  "../supabase/demo-data/remove_launch_demo_listings.sql",
  import.meta.url,
);
const readmePath = new URL("../supabase/demo-data/README.md", import.meta.url);

const [seed, cleanup, readme] = await Promise.all([
  readFile(seedPath, "utf8"),
  readFile(cleanupPath, "utf8"),
  readFile(readmePath, "utf8"),
]);
const sharedCard = await readFile(
  new URL("../src/features/listings/cards/ListingCardShared.tsx", import.meta.url),
  "utf8",
);
const featuredCard = await readFile(
  new URL("../src/features/listings/cards/FeaturedShowcaseCard.tsx", import.meta.url),
  "utf8",
);
const listingDetail = await readFile(
  new URL("../src/routes/listings.$id.tsx", import.meta.url),
  "utf8",
);
const demoGuard = await readFile(new URL("../src/lib/demo-listing.ts", import.meta.url), "utf8");
const applyMedia = await readFile(new URL("./apply-demo-media-pack.mjs", import.meta.url), "utf8");
const removeMedia = await readFile(
  new URL("./remove-demo-media-pack.mjs", import.meta.url),
  "utf8",
);

const batch = "launch-catalog-v1";
const reservedIds = [...seed.matchAll(/'((?:da100001)-[0-9a-f-]{27})'/g)].map((match) => match[1]);
const categories = [
  "cars",
  "realestate",
  "mobiles",
  "electronics",
  "furniture",
  "jobs",
  "services",
  "fashion",
  "food",
  "animals",
  "education",
  "business",
  "misc",
];

test("demo catalog remains isolated from schema migrations", () => {
  assert.match(readme, /outside `supabase\/migrations`/);
  assert.doesNotMatch(seedPath.pathname, /migrations/);
  assert.doesNotMatch(cleanupPath.pathname, /migrations/);
});

test("seed has a stable removable batch marker", () => {
  assert.match(seed, new RegExp(batch));
  assert.match(seed, /'_rawaj_seed'/);
  assert.match(seed, /'launch_demo'/);
  assert.match(seed, /'removable', true/);
  assert.match(seed, /on conflict \(id\) do update/);
  assert.match(seed, /where public\.listings\.details #>> '\{_rawaj_seed,batch\}' = v_batch/);
});

test("seed contains 26 deterministic unique listing ids", () => {
  assert.equal(reservedIds.length, 26);
  assert.equal(new Set(reservedIds).size, 26);
});

test("seed covers every top-level marketplace category", () => {
  for (const category of categories) {
    assert.match(seed, new RegExp(`'${category}'`));
  }
});

test("seed fails closed when owner or references are unavailable", () => {
  assert.match(seed, /current_setting\('rawaj\.environment', true\)/);
  assert.match(seed, /not in \('development', 'staging'\)/);
  assert.match(seed, /no auth user found/);
  assert.match(seed, /must be an active owner\/admin/);
  assert.match(seed, /missing active categories/);
  assert.match(seed, /missing active governorates/);
});

test("demo media scripts require explicit non-production intent", () => {
  assert.match(applyMedia, /RAWAJ_DEMO_ENVIRONMENT/);
  assert.match(applyMedia, /\["development", "staging"\]/);
  assert.match(removeMedia, /RAWAJ_DEMO_CLEANUP_BATCH/);
  assert.match(removeMedia, /cleanupBatch !== manifest\.batch/);
});

test("public demo listings are always visibly labeled", () => {
  assert.match(demoGuard, /seed\.batch === RAWAJ_DEMO_BATCH/);
  assert.match(demoGuard, /listing\.id\.startsWith\("da100001-"\)/);
  for (const surface of [sharedCard, featuredCard, listingDetail]) {
    assert.match(surface, /isLaunchDemoListing/);
    assert.match(surface, /إعلان تجريبي/);
    assert.match(surface, /Demo listing/);
  }
});

test("cleanup targets only the tagged removable batch", () => {
  assert.match(cleanup, new RegExp(batch));
  assert.match(cleanup, /details #>> '\{_rawaj_seed,kind\}' = 'launch_demo'/);
  assert.match(
    cleanup,
    /coalesce\(\(details #>> '\{_rawaj_seed,removable\}'\)::boolean, false\) = true/,
  );
  assert.doesNotMatch(cleanup, /delete from public\.listings\s*;/);
  assert.match(cleanup, /cleanup incomplete/);
});
