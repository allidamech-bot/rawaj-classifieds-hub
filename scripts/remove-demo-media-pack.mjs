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
const paths = manifest.listings.flatMap((listing) =>
  Array.from({ length: listing.count }, (_, index) =>
    `${manifest.batch}/${listing.category}/${listing.slug}/${String(index + 1).padStart(2, "0")}.png`,
  ),
);

const { error: rowDeleteError } = await client
  .from("listing_images")
  .delete()
  .in("listing_id", listingIds)
  .in("storage_path", paths);
if (rowDeleteError) throw rowDeleteError;

for (let index = 0; index < paths.length; index += 100) {
  const { error: storageError } = await client.storage
    .from(manifest.bucket)
    .remove(paths.slice(index, index + 100));
  if (storageError) throw storageError;
}

const { data: remaining, error: remainingError } = await client
  .from("listing_images")
  .select("id")
  .in("storage_path", paths);
if (remainingError) throw remainingError;
if ((remaining ?? []).length > 0) throw new Error("Demo media cleanup incomplete.");

console.log(`RAWAJ demo media cleanup complete: ${paths.length} storage paths removed.`);
