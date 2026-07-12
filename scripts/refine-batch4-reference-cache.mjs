import { readFile, writeFile } from "node:fs/promises";

const path = "src/lib/api/references.ts";
const source = await readFile(path, "utf8");
const start = source.indexOf("type PublicReferencesResult =");
const end = source.indexOf("export async function fetchPublicSubcategories");

if (start < 0 || end <= start) {
  throw new Error("Could not locate the public reference cache section.");
}

const replacement = `interface PublicReferenceCacheEntry<T> {
  expiresAt: number;
  promise: Promise<ClassifiedsResult<T>>;
}

const publicReferenceCacheTtlMs = 5 * 60 * 1000;
const publicCategoryCache = new WeakMap<
  SupabaseClient,
  PublicReferenceCacheEntry<ClassifiedCategory[]>
>();
const publicGovernorateCache = new WeakMap<
  SupabaseClient,
  PublicReferenceCacheEntry<ClassifiedGovernorate[]>
>();

async function readCachedPublicReference<T>(
  client: SupabaseClient,
  cache: WeakMap<SupabaseClient, PublicReferenceCacheEntry<T>>,
  loader: () => Promise<ClassifiedsResult<T>>,
): Promise<ClassifiedsResult<T>> {
  const now = Date.now();
  const cached = cache.get(client);
  if (cached && cached.expiresAt > now) return cached.promise;

  const entry: PublicReferenceCacheEntry<T> = {
    expiresAt: now + publicReferenceCacheTtlMs,
    promise: loader(),
  };
  cache.set(client, entry);

  try {
    const result = await entry.promise;
    if (!result.ok && cache.get(client) === entry) cache.delete(client);
    return result;
  } catch (error) {
    if (cache.get(client) === entry) cache.delete(client);
    throw error;
  }
}

async function loadPublicCategories(
  client: SupabaseClient,
): Promise<ClassifiedsResult<ClassifiedCategory[]>> {
  const { data, error } = await client
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Record<string, unknown>[]).map(mapCategory) };
}

async function readPublicCategories(
  client: SupabaseClient,
): Promise<ClassifiedsResult<ClassifiedCategory[]>> {
  return readCachedPublicReference(client, publicCategoryCache, () => loadPublicCategories(client));
}

async function loadPublicGovernorates(
  client: SupabaseClient,
): Promise<ClassifiedsResult<ClassifiedGovernorate[]>> {
  const { data, error } = await client
    .from("governorates")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) return { ok: false, error: mapError(error) };
  const governorates = ((data ?? []) as Record<string, unknown>[]).map(mapGovernorate);
  return {
    ok: true,
    data: await enrichGovernoratesWithLocationPaths(client, governorates),
  };
}

async function readPublicGovernorates(
  client: SupabaseClient,
): Promise<ClassifiedsResult<ClassifiedGovernorate[]>> {
  return readCachedPublicReference(client, publicGovernorateCache, () =>
    loadPublicGovernorates(client),
  );
}

export async function readReferences(client: SupabaseClient) {
  const [categoriesResult, governoratesResult] = await Promise.all([
    readPublicCategories(client),
    readPublicGovernorates(client),
  ]);
  if (!categoriesResult.ok) return categoriesResult;
  if (!governoratesResult.ok) return governoratesResult;
  return {
    ok: true as const,
    categories: categoriesResult.data,
    governorates: governoratesResult.data,
  };
}

export async function fetchPublicCategories(): Promise<ClassifiedsResult<ClassifiedCategory[]>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  return readPublicCategories(clientResult.data);
}

`;

const next = source.slice(0, start) + replacement + source.slice(end);
const withoutUnusedErrorType = next.replace("  ClassifiedsError,\n", "");
await writeFile(path, withoutUnusedErrorType);
console.log("Refined Batch 4 public reference caches.");
