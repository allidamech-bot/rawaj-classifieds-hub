import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const [primarySource, listingsSource, referencesSource, packageJson, qualityGate] =
  await Promise.all([
    readFile(new URL("../src/lib/api/primary-listing-images.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/api/listings.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/api/references.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
  ]);

const transpiledPrimarySelector = ts.transpileModule(primarySource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { selectPrimaryListingImages } = await import(
  `data:text/javascript;base64,${Buffer.from(transpiledPrimarySelector).toString("base64")}`
);

function image(id, listingId, sortOrder, createdAt) {
  return {
    id,
    listingId,
    storagePath: `${listingId}/${id}.webp`,
    publicUrl: null,
    signedUrlExpiresIn: null,
    altAr: null,
    sortOrder,
    createdAt,
  };
}

test("primary image selection returns one deterministic image per listing", () => {
  const selected = selectPrimaryListingImages([
    image("a-late", "listing-a", 2, "2026-07-12T03:00:00Z"),
    image("b-main", "listing-b", 0, "2026-07-12T03:00:00Z"),
    image("a-main-newer", "listing-a", 0, "2026-07-12T04:00:00Z"),
    image("a-main-older", "listing-a", 0, "2026-07-12T02:00:00Z"),
  ]);

  assert.deepEqual(selected.map((item) => item.id).sort(), ["a-main-older", "b-main"]);
});

test("listing collections sign only selected primary images", () => {
  const readStart = listingsSource.indexOf("async function readListingImagesByListingIds");
  const hydrateStart = listingsSource.indexOf(
    "export async function hydrateListingsWithPrimaryImages",
  );
  const createStart = listingsSource.indexOf("function buildNextCursor", hydrateStart);
  const readBlock = listingsSource.slice(readStart, hydrateStart);
  const hydrateBlock = listingsSource.slice(hydrateStart, createStart);

  assert.ok(readStart >= 0 && hydrateStart > readStart && createStart > hydrateStart);
  assert.ok(!readBlock.includes("signListingImages"));
  assert.ok(hydrateBlock.includes("selectPrimaryListingImages(images)"));
  assert.ok(hydrateBlock.includes("signListingImages(client, primaryImages)"));
  assert.ok(hydrateBlock.includes("signedPrimaryImages"));
});

test("listing detail gallery continues signing every requested gallery image", () => {
  const galleryStart = listingsSource.indexOf("export async function fetchListingImages");
  const galleryBlock = listingsSource.slice(galleryStart);
  assert.ok(galleryStart >= 0);
  assert.ok(galleryBlock.includes("signListingImages(clientResult.data, images)"));
});

test("public categories and governorates use separate client-scoped TTL caches", () => {
  assert.ok(referencesSource.includes("interface PublicReferenceCacheEntry<T>"));
  assert.ok(referencesSource.includes("publicReferenceCacheTtlMs = 5 * 60 * 1000"));
  assert.ok(referencesSource.includes("const publicCategoryCache = new WeakMap<"));
  assert.ok(referencesSource.includes("const publicGovernorateCache = new WeakMap<"));
  assert.ok(referencesSource.includes("async function readCachedPublicReference<T>"));
  assert.ok(
    referencesSource.includes("if (cached && cached.expiresAt > now) return cached.promise"),
  );
  assert.ok(referencesSource.includes("if (!result.ok && cache.get(client) === entry)"));
});

test("combined references share cached subset reads without coupling category-only callers", () => {
  const referencesStart = referencesSource.indexOf("export async function readReferences");
  const categoriesStart = referencesSource.indexOf("export async function fetchPublicCategories");
  const subcategoriesStart = referencesSource.indexOf(
    "export async function fetchPublicSubcategories",
  );
  const governoratesStart = referencesSource.indexOf(
    "export async function fetchPublicGovernorates",
  );
  const referencesBlock = referencesSource.slice(referencesStart, categoriesStart);
  const categoriesBlock = referencesSource.slice(categoriesStart, subcategoriesStart);
  const governoratesBlock = referencesSource.slice(governoratesStart);

  assert.ok(referencesBlock.includes("readPublicCategories(client)"));
  assert.ok(referencesBlock.includes("readPublicGovernorates(client)"));
  assert.ok(categoriesBlock.includes("readPublicCategories(clientResult.data)"));
  assert.ok(!categoriesBlock.includes("readPublicGovernorates"));
  assert.ok(!categoriesBlock.includes('.from("categories")'));
  assert.ok(governoratesBlock.includes("readPublicGovernorates(clientResult.data)"));
  assert.ok(!governoratesBlock.includes("readPublicCategories"));
  assert.ok(!governoratesBlock.includes('.from("governorates")'));
});

test("Batch 4 performance regression is part of local and GitHub quality gates", () => {
  const parsed = JSON.parse(packageJson);
  assert.ok(parsed.scripts["test:launch-readiness-batch-4"]);
  assert.ok(parsed.scripts.check.includes("test:launch-readiness-batch-4"));
  assert.ok(qualityGate.includes("Launch readiness Batch 4 contract"));
  assert.ok(qualityGate.includes("npm run test:launch-readiness-batch-4"));
});
