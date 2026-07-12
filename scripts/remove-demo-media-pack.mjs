import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const manifestUrl = new URL("../supabase/demo-data/demo-media-manifest.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const listingIds = manifest.listings.map((listing) => listing.id);
const { data: imageRows, error: readError } = await client
  .from("listing_images")
  .select("id, listing_id, storage_path")
  .in("listing_id", listingIds);
if (readError) throw readError;

const managedRows = (imageRows ?? []).filter((row) => {
  const path = row.storage_path ?? "";
  return path.startsWith(`${manifest.batch}/`) || path.includes(`/${manifest.batch}-`);
});
const paths = [...new Set(managedRows.map((row) => row.storage_path).filter(Boolean))];
const rowIds = managedRows.map((row) => row.id);

if (rowIds.length > 0) {
  const { error: rowDeleteError } = await client.from("listing_images").delete().in("id", rowIds);
  if (rowDeleteError) throw rowDeleteError;
}

for (let index = 0; index < paths.length; index += 100) {
  const { error: storageError } = await client.storage
    .from(manifest.bucket)
    .remove(paths.slice(index, index + 100));
  if (storageError) throw storageError;
}

const { data: remaining, error: remainingError } = await client
  .from("listing_images")
  .select("id, storage_path")
  .in("listing_id", listingIds);
if (remainingError) throw remainingError;
const remainingManaged = (remaining ?? []).filter((row) => {
  const path = row.storage_path ?? "";
  return path.startsWith(`${manifest.batch}/`) || path.includes(`/${manifest.batch}-`);
});
if (remainingManaged.length > 0) throw new Error("Demo media cleanup incomplete.");

console.log(`RAWAJ demo media cleanup complete: ${paths.length} storage paths removed.`);
