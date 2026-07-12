import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  const first = source.indexOf(before);
  if (first === -1) throw new Error(`Missing expected source in ${path}: ${before.slice(0, 120)}`);
  if (source.indexOf(before, first + before.length) !== -1) {
    throw new Error(`Expected one match in ${path}: ${before.slice(0, 120)}`);
  }
  await writeFile(path, source.slice(0, first) + after + source.slice(first + before.length));
}

await replaceOnce(
  "src/lib/api/listings.ts",
  `import { publicListingSelect } from "@/lib/api/public-fields";
import { buildListingImagePath, listingImagesBucket, validateImageFile } from "@/lib/api/storage";
`,
  `import { publicListingSelect } from "@/lib/api/public-fields";
import { selectPrimaryListingImages } from "@/lib/api/primary-listing-images";
import { buildListingImagePath, listingImagesBucket, validateImageFile } from "@/lib/api/storage";
`,
);

await replaceOnce(
  "src/lib/api/listings.ts",
  `  if (error) return [];
  return signListingImages(client, ((data ?? []) as Record<string, unknown>[]).map(mapImage));
}

export async function hydrateListingsWithPrimaryImages(
  client: SupabaseClient,
  listings: ClassifiedListing[],
): Promise<ClassifiedListing[]> {
  if (listings.length === 0) return listings;

  const images = await readListingImagesByListingIds(
    client,
    listings.map((listing) => listing.id),
  );
  if (images.length === 0) return listings;

  const firstImageByListing = new Map<string, ListingImage>();
  for (const image of images) {
    if (!firstImageByListing.has(image.listingId)) {
      firstImageByListing.set(image.listingId, image);
    }
  }

  return listings.map((listing) => ({
    ...listing,
    primaryImageUrl: firstImageByListing.get(listing.id)?.publicUrl ?? null,
  }));
}
`,
  `  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map(mapImage);
}

export async function hydrateListingsWithPrimaryImages(
  client: SupabaseClient,
  listings: ClassifiedListing[],
): Promise<ClassifiedListing[]> {
  if (listings.length === 0) return listings;

  const images = await readListingImagesByListingIds(
    client,
    listings.map((listing) => listing.id),
  );
  if (images.length === 0) return listings;

  const primaryImages = selectPrimaryListingImages(images);
  const signedPrimaryImages = await signListingImages(client, primaryImages);
  const primaryImageByListing = new Map(
    signedPrimaryImages.map((image) => [image.listingId, image] as const),
  );

  return listings.map((listing) => ({
    ...listing,
    primaryImageUrl: primaryImageByListing.get(listing.id)?.publicUrl ?? null,
  }));
}
`,
);

await replaceOnce(
  "src/lib/api/references.ts",
  `  ClassifiedCategory,
  ClassifiedGovernorate,
  ClassifiedsResult,
`,
  `  ClassifiedCategory,
  ClassifiedGovernorate,
  ClassifiedsError,
  ClassifiedsResult,
`,
);

await replaceOnce(
  "src/lib/api/references.ts",
  `export async function readReferences(client: SupabaseClient) {
  const [categoriesResult, governoratesResult] = await Promise.all([
    client.from("categories").select("*").eq("is_active", true).order("sort_order"),
    client.from("governorates").select("*").eq("is_active", true).order("sort_order"),
  ]);

  if (categoriesResult.error)
    return { ok: false as const, error: mapError(categoriesResult.error) };
  if (governoratesResult.error)
    return { ok: false as const, error: mapError(governoratesResult.error) };

  const governorates = ((governoratesResult.data ?? []) as Record<string, unknown>[]).map(
    mapGovernorate,
  );
  return {
    ok: true as const,
    categories: ((categoriesResult.data ?? []) as Record<string, unknown>[]).map(mapCategory),
    governorates: await enrichGovernoratesWithLocationPaths(client, governorates),
  };
}
`,
  `type PublicReferencesResult =
  | {
      ok: true;
      categories: ClassifiedCategory[];
      governorates: ClassifiedGovernorate[];
    }
  | { ok: false; error: ClassifiedsError };

interface PublicReferenceCacheEntry {
  expiresAt: number;
  promise: Promise<PublicReferencesResult>;
}

const publicReferenceCacheTtlMs = 5 * 60 * 1000;
const publicReferenceCache = new WeakMap<SupabaseClient, PublicReferenceCacheEntry>();

async function loadPublicReferences(client: SupabaseClient): Promise<PublicReferencesResult> {
  const [categoriesResult, governoratesResult] = await Promise.all([
    client.from("categories").select("*").eq("is_active", true).order("sort_order"),
    client.from("governorates").select("*").eq("is_active", true).order("sort_order"),
  ]);

  if (categoriesResult.error) return { ok: false, error: mapError(categoriesResult.error) };
  if (governoratesResult.error) return { ok: false, error: mapError(governoratesResult.error) };

  const governorates = ((governoratesResult.data ?? []) as Record<string, unknown>[]).map(
    mapGovernorate,
  );
  return {
    ok: true,
    categories: ((categoriesResult.data ?? []) as Record<string, unknown>[]).map(mapCategory),
    governorates: await enrichGovernoratesWithLocationPaths(client, governorates),
  };
}

export async function readReferences(client: SupabaseClient): Promise<PublicReferencesResult> {
  const now = Date.now();
  const cached = publicReferenceCache.get(client);
  if (cached && cached.expiresAt > now) return cached.promise;

  const entry: PublicReferenceCacheEntry = {
    expiresAt: now + publicReferenceCacheTtlMs,
    promise: loadPublicReferences(client),
  };
  publicReferenceCache.set(client, entry);

  try {
    const result = await entry.promise;
    if (!result.ok && publicReferenceCache.get(client) === entry) {
      publicReferenceCache.delete(client);
    }
    return result;
  } catch (error) {
    if (publicReferenceCache.get(client) === entry) publicReferenceCache.delete(client);
    throw error;
  }
}
`,
);

await replaceOnce(
  "src/lib/api/references.ts",
  `export async function fetchPublicCategories(): Promise<ClassifiedsResult<ClassifiedCategory[]>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const { data, error } = await clientResult.data
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Record<string, unknown>[]).map(mapCategory) };
}
`,
  `export async function fetchPublicCategories(): Promise<ClassifiedsResult<ClassifiedCategory[]>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const references = await readReferences(clientResult.data);
  if (!references.ok) return references;
  return { ok: true, data: references.categories };
}
`,
);

await replaceOnce(
  "src/lib/api/references.ts",
  `export async function fetchPublicGovernorates(): Promise<
  ClassifiedsResult<ClassifiedGovernorate[]>
> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const { data, error } = await clientResult.data
    .from("governorates")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) return { ok: false, error: mapError(error) };
  const governorates = ((data ?? []) as Record<string, unknown>[]).map(mapGovernorate);
  return {
    ok: true,
    data: await enrichGovernoratesWithLocationPaths(clientResult.data, governorates),
  };
}
`,
  `export async function fetchPublicGovernorates(): Promise<
  ClassifiedsResult<ClassifiedGovernorate[]>
> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const references = await readReferences(clientResult.data);
  if (!references.ok) return references;
  return { ok: true, data: references.governorates };
}
`,
);

await writeFile(
  "scripts/launch-readiness-batch-4.test.mjs",
  `import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const [primarySource, listingsSource, referencesSource, packageJson, qualityGate] = await Promise.all([
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
  \`data:text/javascript;base64,\${Buffer.from(transpiledPrimarySelector).toString("base64")}\`
);

function image(id, listingId, sortOrder, createdAt) {
  return {
    id,
    listingId,
    storagePath: \`\${listingId}/\${id}.webp\`,
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

  assert.deepEqual(
    selected.map((item) => item.id).sort(),
    ["a-main-older", "b-main"],
  );
});

test("listing collections sign only selected primary images", () => {
  const readStart = listingsSource.indexOf("async function readListingImagesByListingIds");
  const hydrateStart = listingsSource.indexOf("export async function hydrateListingsWithPrimaryImages");
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

test("public references use a client-scoped TTL and in-flight promise cache", () => {
  assert.ok(referencesSource.includes("new WeakMap<SupabaseClient, PublicReferenceCacheEntry>()"));
  assert.ok(referencesSource.includes("publicReferenceCacheTtlMs = 5 * 60 * 1000"));
  assert.ok(referencesSource.includes("if (cached && cached.expiresAt > now) return cached.promise"));
  assert.ok(referencesSource.includes("promise: loadPublicReferences(client)"));
  assert.ok(referencesSource.includes("publicReferenceCache.delete(client)"));
});

test("category and governorate readers reuse the unified public reference request", () => {
  const categoriesStart = referencesSource.indexOf("export async function fetchPublicCategories");
  const subcategoriesStart = referencesSource.indexOf("export async function fetchPublicSubcategories");
  const governoratesStart = referencesSource.indexOf("export async function fetchPublicGovernorates");
  const categoriesBlock = referencesSource.slice(categoriesStart, subcategoriesStart);
  const governoratesBlock = referencesSource.slice(governoratesStart);

  assert.ok(categoriesBlock.includes("readReferences(clientResult.data)"));
  assert.ok(categoriesBlock.includes("references.categories"));
  assert.ok(!categoriesBlock.includes('.from("categories")'));
  assert.ok(governoratesBlock.includes("readReferences(clientResult.data)"));
  assert.ok(governoratesBlock.includes("references.governorates"));
  assert.ok(!governoratesBlock.includes('.from("governorates")'));
});

test("Batch 4 performance regression is part of local and GitHub quality gates", () => {
  const parsed = JSON.parse(packageJson);
  assert.ok(parsed.scripts["test:launch-readiness-batch-4"]);
  assert.ok(parsed.scripts.check.includes("test:launch-readiness-batch-4"));
  assert.ok(qualityGate.includes("Launch readiness Batch 4 contract"));
  assert.ok(qualityGate.includes("npm run test:launch-readiness-batch-4"));
});
`,
);

await replaceOnce(
  "package.json",
  `&& npm run test:launch-readiness-batch-2 && npm run test:activity-center`,
  `&& npm run test:launch-readiness-batch-2 && npm run test:launch-readiness-batch-4 && npm run test:activity-center`,
);
await replaceOnce(
  "package.json",
  `    "test:launch-readiness-batch-2": "node --test scripts/launch-readiness-batch-2.test.mjs",
`,
  `    "test:launch-readiness-batch-2": "node --test scripts/launch-readiness-batch-2.test.mjs",
    "test:launch-readiness-batch-4": "node --test scripts/launch-readiness-batch-4.test.mjs",
`,
);

console.log("Launch readiness Batch 4 patch applied.");
